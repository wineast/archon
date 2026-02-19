/**
 * Unified entry point for executing tool handler code.
 *
 * Dispatches to QuickJS sandbox (light) or Vercel Sandbox (full).
 * Replaces all `new Function()` patterns across the codebase.
 */

import type { ToolContext } from "./tool-context";
import { executeToolInSandbox } from "./sandbox";

export type SandboxMode = "light" | "full";

/**
 * Execute a tool handler in a sandboxed environment.
 *
 * @param handlerCode - JS expression that evaluates to a function: `(args, context) => ...`
 * @param args - Input arguments
 * @param context - ToolContext with wiki/dataset/fn/ontology
 * @param sandboxMode - "light" (QuickJS) or "full" (Vercel Sandbox, P2)
 */
export async function executeToolHandler(
  handlerCode: string,
  args: unknown,
  context: ToolContext,
  sandboxMode: SandboxMode = "light"
): Promise<unknown> {
  if (sandboxMode === "full") {
    // P2: dynamic import to avoid bundling Vercel Sandbox unless needed
    const { executeToolInFullSandbox } = await import("./sandbox-full");
    return executeToolInFullSandbox(handlerCode, args, context);
  }

  return executeToolInSandbox(handlerCode, args, context);
}
