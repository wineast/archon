/**
 * Tool implementations barrel.
 *
 * Side-effect imports trigger self-registration of each tool.
 * Import this module once (e.g. in the chat route) to activate all implementations.
 *
 * Note: Pricing tools have been migrated to dynamic functions (context.fn).
 * No static registrations remain, but the registry API is still exported
 * for potential future use.
 */

// Re-export registry API for external use
export { registerTool, getToolExecutor } from "./_registry";
export type { ToolExecutor } from "./_types";
