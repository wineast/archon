import { nanoid } from "nanoid";
import {
  isTextUIPart,
  isToolUIPart,
  getToolName,
  type UIMessage,
} from "ai";
import type { EvalTurn, EvalTurnToolCall } from "./types";

/**
 * Parse UIMessage[] (from Request Inspector) into EvalTurn[].
 * - Skips system messages
 * - Collects text parts into content
 * - Collects tool parts into toolCalls
 */
export function parseUIMessagesToTurns(messages: UIMessage[]): EvalTurn[] {
  const turns: EvalTurn[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue;
    if (msg.role !== "user" && msg.role !== "assistant") continue;

    const textParts: string[] = [];
    const toolCalls: EvalTurnToolCall[] = [];

    for (const part of msg.parts ?? []) {
      if (isTextUIPart(part)) {
        textParts.push(part.text);
      } else if (isToolUIPart(part)) {
        const name = getToolName(part);
        const args =
          part.input != null && typeof part.input === "object"
            ? (part.input as Record<string, unknown>)
            : {};
        const result =
          part.output !== undefined ? JSON.stringify(part.output) : "";
        toolCalls.push({ name, args, result });
      }
    }

    const turn: EvalTurn = {
      id: nanoid(),
      role: msg.role,
      content: textParts.join("\n"),
    };

    if (toolCalls.length > 0) {
      turn.toolCalls = toolCalls;
    }

    turns.push(turn);
  }

  return turns;
}
