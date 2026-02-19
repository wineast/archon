import { tool, type Tool } from "ai";
import type { ToolDefinitionPayload } from "@/lib/tools/types";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import { createToolContext } from "@/lib/tools/tool-context";
import type { TemplateData } from "@/lib/template/render";

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
 *   1. handler is a URL     → HTTP POST to that URL
 *   2. handler is JS code   → dynamic execution
 *   3. no handler           → error
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveExecutor(def: ToolDefinitionPayload, agentId?: string): (args: any) => Promise<any> {
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

    // 2. JS code handler → dynamic execution
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

    // Unrecognized handler format
    return async () => ({
      error: `Invalid handler: must be a URL (http/https) or JS code (arrow function / function)`,
    });
  }

  // No handler → error
  return async () => ({
    error: `Tool "${def.name}" has no handler configured`,
  });
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

  for (const def of definitions) {
    const inputSchema = buildInputSchema(
      def.parameters,
      templateData?.resolvedVars
    );

    if (def.executionTarget === "client") {
      // Client tools: schema only, no execute → tool call passes through to frontend
      tools[def.name] = tool({ description: def.description, inputSchema });
    } else {
      tools[def.name] = tool({
        description: def.description,
        inputSchema,
        execute: resolveExecutor(def, agentId),
      });
    }
  }

  return tools;
}
