/**
 * Unified entry point for executing tool handler code.
 *
 * Uses direct `new Function()` execution with static code scanning.
 */

import type { ToolContext } from "./tool-context";
import { scanCode } from "@/lib/code-scanner";
import { transformToolHandlerImports } from "@/lib/modules/transform-tool-handler";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...args: any[]) => Promise<any>;

/**
 * Execute a tool handler using direct execution with static code scanning.
 *
 * @param handlerCode - ES module code string with `export default` function
 * @param args - Input arguments
 * @param context - ToolContext with wiki/dataset/fn/ontology
 */
export async function executeToolHandler(
  handlerCode: string,
  args: unknown,
  context: ToolContext,
): Promise<unknown> {
  // Static scan
  const scan = scanCode(handlerCode);
  if (!scan.ok) {
    throw new Error(`Code scan failed:\n${scan.errors.join("\n")}`);
  }

  // Transform ES module imports into IIFE
  const transformed = transformToolHandlerImports(handlerCode);

  // Execute using AsyncFunction (supports await in handler code)
  const fn = new AsyncFunction("__args", "__context", `return ${transformed}`);
  return await fn(args, context);
}
