/**
 * Vercel Sandbox (Firecracker micro-VM) for heavy tool execution.
 *
 * Provides full Node.js runtime isolation via a Firecracker micro-VM.
 * ToolContext methods are proxied back to the host process via IPC messaging.
 *
 * TODO(P2): Install @vercel/sandbox and implement full VM execution.
 * For now, falls back to the light QuickJS sandbox.
 */

import type { ToolContext } from "./tool-context";
import { executeToolInSandbox } from "./sandbox";

/**
 * Execute a tool handler in a Vercel Sandbox Firecracker micro-VM.
 *
 * @param handlerCode - ES module code string with `export default` function
 * @param args - Input arguments
 * @param context - ToolContext (proxied to VM via IPC)
 */
export async function executeToolInFullSandbox(
  handlerCode: string,
  args: unknown,
  context: ToolContext
): Promise<unknown> {
  // TODO(P2): Implement Vercel Sandbox execution with IPC context proxy.
  // For now, delegate to light sandbox.
  console.warn(
    "[sandbox-full] @vercel/sandbox not yet configured, falling back to QuickJS sandbox"
  );
  return executeToolInSandbox(handlerCode, args, context);
}
