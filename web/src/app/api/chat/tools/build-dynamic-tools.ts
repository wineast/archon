import { tool, type Tool } from "ai";
import type { z } from "zod";
import type { ToolDefinitionPayload } from "@/lib/tools/types";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import { createToolContext } from "@/lib/tools/tool-context";
import { executeToolHandler } from "@/lib/tools/execute-handler";
import type { TemplateData } from "@/lib/template/render";
import type { RuntimeEventInput } from "@/lib/runtime-events/record";

/**
 * Resolve the execute function for a tool definition.
 *
 * Priority:
 *   1. url field set   → HTTP POST to that URL
 *   2. handler field set → JS sandbox execution
 *   3. neither         → error
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveExecutor(def: ToolDefinitionPayload, agentId?: string): (args: any) => Promise<any> {
  const url = def.url?.trim();
  if (url) {
    return async (args) => {
      const res = await fetch(url, {
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

  const handler = def.handler?.trim();
  if (handler) {
    const context = createToolContext(agentId);
    const sandboxMode = def.sandboxMode ?? "light";
    return async (args) => {
      try {
        return await executeToolHandler(handler, args, context, sandboxMode);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: `JS handler execution error: ${msg}` };
      }
    };
  }

  return async () => ({
    error: `Tool "${def.name}" has no handler configured`,
  });
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/**
 * Wrap an executor with timing + event collection.
 */
function wrapExecutorWithTiming(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executor: (args: any) => Promise<any>,
  toolName: string,
  agentId: string,
  collector: RuntimeEventInput[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (args: any) => Promise<any> {
  return async (args) => {
    const start = performance.now();
    try {
      const result = await executor(args);
      const durationMs = Math.round(performance.now() - start);
      const inputStr = JSON.stringify(args);
      const outputStr = JSON.stringify(result);

      // Check if the tool returned an error object
      const isError =
        result && typeof result === "object" && "error" in result;

      collector.push({
        agentId,
        eventType: isError ? "tool_error" : "tool_call",
        severity: isError ? "warning" : "info",
        durationMs,
        metadata: {
          toolName,
          inputSize: inputStr.length,
          outputSize: outputStr.length,
          ...(isError
            ? { error: truncate(String(result.error), 500) }
            : {}),
        },
      });

      return result;
    } catch (e) {
      const durationMs = Math.round(performance.now() - start);
      const errorMsg =
        e instanceof Error ? e.message : String(e);
      const isTimeout =
        errorMsg.toLowerCase().includes("timeout") ||
        errorMsg.toLowerCase().includes("timed out");

      collector.push({
        agentId,
        eventType: isTimeout ? "tool_timeout" : "tool_error",
        severity: "error",
        durationMs,
        metadata: {
          toolName,
          inputSize: JSON.stringify(args).length,
          error: truncate(errorMsg, 500),
        },
      });

      throw e;
    }
  };
}

/**
 * Wrap an executor with output schema validation.
 * On mismatch, injects `_outputValidationWarning` and records a runtime event.
 */
export function wrapWithOutputValidation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executor: (args: any) => Promise<any>,
  toolName: string,
  outputSchema: z.ZodObject<z.ZodRawShape>,
  agentId: string,
  collector: RuntimeEventInput[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (args: any) => Promise<any> {
  return async (args) => {
    const result = await executor(args);

    // Skip validation for non-validatable results
    if (
      result == null ||
      typeof result !== "object" ||
      Array.isArray(result) ||
      ("error" in result && typeof result.error === "string")
    ) {
      return result;
    }

    const parsed = outputSchema.passthrough().safeParse(result);
    if (!parsed.success) {
      const warning = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      console.warn(
        `[output-validation] Tool "${toolName}" output mismatch: ${warning}`
      );
      collector.push({
        agentId,
        eventType: "tool_output_validation",
        severity: "warning",
        metadata: {
          toolName,
          issues: warning.slice(0, 500),
        },
      });
      return { ...result, _outputValidationWarning: warning };
    }

    return result;
  };
}

/**
 * Convert UI-defined tool payloads into AI SDK tool objects.
 */
export function buildDynamicTools(
  definitions: ToolDefinitionPayload[],
  templateData?: TemplateData,
  agentId?: string,
  collector?: RuntimeEventInput[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, Tool<any, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, Tool<any, any>> = {};

  for (const def of definitions) {
    const inputSchema = buildInputSchema(
      def.parameters,
      templateData?.resolvedVars,
      {
        defsMap: templateData?.defsMap,
      }
    );

    if (def.executionTarget === "client" || def.executionTarget === "host") {
      // Client tools: schema only, no execute → tool call passes through to frontend
      tools[def.name] = tool({ description: def.description, inputSchema });
    } else {
      const executor = resolveExecutor(def, agentId);
      let execute =
        collector && agentId
          ? wrapExecutorWithTiming(executor, def.name, agentId, collector)
          : executor;

      // Chain output validation if returnParameters are defined
      if (def.returnParameters && def.returnParameters.properties && Object.keys(def.returnParameters.properties).length > 0 && collector && agentId) {
        const outputSchema = buildInputSchema(
          def.returnParameters,
          templateData?.resolvedVars,
          {
            defsMap: templateData?.defsMap,
          }
        );
        execute = wrapWithOutputValidation(execute, def.name, outputSchema, agentId, collector);
      }

      tools[def.name] = tool({
        description: def.description,
        inputSchema,
        execute,
      });
    }
  }

  return tools;
}
