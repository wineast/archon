import { tool, type Tool } from "ai";
import type { ToolDefinitionPayload } from "@/lib/tools/types";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import { getToolExecutor } from "@/tool-impls";
import { createToolContext } from "@/lib/tools/tool-context";
import { renderTemplate, type TemplateData } from "@/lib/template/render";

function isUrl(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://");
}

function isJsCode(s: string): boolean {
  return s.includes("=>") || s.includes("function");
}

/**
 * Resolve the execute function for a tool definition.
 *
 * Priority:
 *   1. handler is a URL          → HTTP POST to that URL
 *   2. handler is a registry key → look up in registry
 *   3. handler is JS code        → dynamic execution
 *   4. handler is key but not in registry → error
 *   5. no handler                → static output field
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveExecutor(def: ToolDefinitionPayload, templateData?: TemplateData, agentId?: string): (args: any) => Promise<any> {
  const handler = def.handler?.trim();

  if (handler) {
    // 1. URL handler → remote API call
    if (isUrl(handler)) {
      return async (args) => {
        const res = await fetch(handler, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
        });
        if (!res.ok) {
          return { error: `Handler returned ${res.status}: ${await res.text()}` };
        }
        return res.json();
      };
    }

    // 2. Registry lookup
    const executor = getToolExecutor(handler);
    if (executor) {
      return async (args) => executor(args);
    }

    // 3. JS code handler → dynamic execution
    if (isJsCode(handler)) {
      // Parse the function once at build time
      let fn: (args: unknown, context: unknown) => unknown;
      try {
        fn = new Function("return (" + handler + ")")() as typeof fn;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return async () => ({ error: `Failed to parse JS handler: ${msg}` });
      }

      const context = createToolContext(agentId);
      return async (args) => {
        try {
          return await fn(args, context);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { error: `JS handler execution error: ${msg}` };
        }
      };
    }

    // 4. Handler set but not found in registry — return error
    return async () => ({
      error: `Handler "${handler}" not found in registry`,
    });
  }

  // 5. No handler → static output (supports LiquidJS template)
  return async () => {
    let output = def.output;
    if (templateData) {
      output = await renderTemplate(output, templateData);
    }
    try {
      return JSON.parse(output);
    } catch {
      return { result: output };
    }
  };
}

/**
 * Convert UI-defined tool payloads into AI SDK tool objects.
 */
export function buildDynamicTools(
  definitions: ToolDefinitionPayload[],
  templateData?: TemplateData,
  agentId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, Tool<any, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, Tool<any, any>> = {};

  // Extract entries from lookupVars + dataObjectVars for schema builder (needs flat entry arrays)
  const lookupEntries = templateData
    ? Object.fromEntries([
        ...Object.entries(templateData.lookupVars ?? {}).map(([key, info]) => [
          key,
          info.entries,
        ]),
        ...Object.entries(templateData.dataObjectVars ?? {}).map(
          ([key, info]) => [
            key,
            Object.entries(info.data).map(([k]) => ({ value: k })),
          ]
        ),
      ])
    : undefined;

  for (const def of definitions) {
    const inputSchema = buildInputSchema(def.parameters, lookupEntries, templateData?.activeVars);

    tools[def.name] = tool({
      description: def.description,
      inputSchema,
      execute: resolveExecutor(def, templateData, agentId),
    });
  }

  return tools;
}
