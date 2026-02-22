import type { AgentScope } from "@/db/schema";

export const RESERVED_SLUGS = ["build-chat", "assist"] as const;
export type ReservedSlug = (typeof RESERVED_SLUGS)[number];

export interface BuiltinAgentDef {
  slug: ReservedSlug;
  name: string;
  icon: string;
  description: string;
  scope: AgentScope;
  defaultModel: string;
  defaultTemperature: number;
}

export const BUILTIN_AGENT_DEFS: Record<ReservedSlug, BuiltinAgentDef> = {
  "build-chat": {
    slug: "build-chat",
    name: "Build Chat",
    icon: "hammer",
    description: "Agent 构建助手，通过对话操作 Agent 资源",
    scope: "org",
    defaultModel: "anthropic/claude-sonnet-4",
    defaultTemperature: 0.3,
  },
  assist: {
    slug: "assist",
    name: "AI 辅助编辑",
    icon: "sparkles",
    description: "AI 辅助编辑器，用于提示词、代码、内容等的智能编辑",
    scope: "org",
    defaultModel: "anthropic/claude-sonnet-4",
    defaultTemperature: 0.7,
  },
};
