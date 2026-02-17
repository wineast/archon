import type { ToolContext } from "@/lib/tools/tool-context";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolExecutor = (args: any, context?: ToolContext) => Promise<any>;
