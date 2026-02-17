/**
 * Tool implementations barrel.
 *
 * Side-effect imports trigger self-registration of each tool.
 * Import this module once (e.g. in the chat route) to activate all implementations.
 */

// Implementation files (each calls registerTool as a side-effect)
import "./pricing";

// Re-export registry API for external use
export { registerTool, getToolExecutor } from "./_registry";
export type { ToolExecutor } from "./_types";
