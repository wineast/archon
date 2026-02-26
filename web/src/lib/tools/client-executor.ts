import type { ToolRow } from "@/db/schema";

export async function executeClientTool(
  toolCall: { toolCallId: string; toolName: string; input: unknown },
  addToolOutput: (opts: { tool: string; toolCallId: string; output: unknown }) => void,
  toolsList: ToolRow[]
) {
  const toolDef = toolsList.find(
    (t) => t.name === toolCall.toolName && t.executionTarget === "client"
  );
  if (!toolDef) {
    addToolOutput({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: { error: "Tool not found" },
    });
    return;
  }

  const handler = toolDef.handler?.trim();
  if (!handler) {
    addToolOutput({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: { error: "No handler" },
    });
    return;
  }

  try {
    const fn = new Function("return (" + handler + ")")();
    const result = await fn(toolCall.input);
    addToolOutput({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: result,
    });
  } catch (e) {
    addToolOutput({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: {
        error: `Client execution error: ${e instanceof Error ? e.message : String(e)}`,
      },
    });
  }
}
