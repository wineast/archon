import { z } from "zod";
import { buildAllTools } from "@/lib/build-chat/tools";
import type { BuiltinToolDef } from "./types";

/**
 * Extract metadata from all code-defined build-chat tools.
 * Returns an array of BuiltinToolDef (key, name, description, parametersSchema).
 */
export function loadBuiltinToolDefs(): BuiltinToolDef[] {
  // Use a dummy agentId — we only need the tool metadata (key + description)
  const allTools = buildAllTools("00000000-0000-0000-0000-000000000000");

  return Object.entries(allTools).map(([key, t]) => {
    const tool = t as { description?: string; inputSchema?: z.ZodType };
    let parametersSchema: Record<string, unknown> | null = null;
    if (tool.inputSchema) {
      try {
        parametersSchema = z.toJSONSchema(tool.inputSchema) as Record<string, unknown>;
      } catch {
        // If conversion fails, leave as null
      }
    }
    return {
      key,
      name: key,
      description: tool.description ?? "",
      parametersSchema,
    };
  });
}
