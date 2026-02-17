/**
 * Tool implementation registry.
 *
 * PM defines tools in the UI (name, description, parameters, output, handler).
 * Engineers register real implementations here, keyed by the tool's `handler` field.
 *
 * At runtime (see build-dynamic-tools.ts):
 *   1. handler is a URL    -> HTTP POST to that URL
 *   2. handler is a key    -> look up in this registry
 *   3. handler is JS code  -> dynamic execution
 *   4. no handler          -> return static output
 *
 * Usage (in an implementation file):
 *   import { registerTool } from "./_registry";
 *   registerTool("my_tool", async (args) => { ... });
 */

import type { ToolExecutor } from "./_types";

const registry = new Map<string, ToolExecutor>();

export function registerTool(key: string, execute: ToolExecutor) {
  registry.set(key, execute);
}

export function getToolExecutor(key: string): ToolExecutor | undefined {
  return registry.get(key);
}
