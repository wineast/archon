import type { SlotKey } from "@/db/schema";

export interface SlotDef {
  label: string;
  description: string;
  defaultAgentSlug: string;
  defaultAgentName: string;
  defaultAgentIcon: string;
  defaultModel: string;
  defaultTemperature: number;
}

export const SLOT_DEFS: Record<SlotKey, SlotDef> = {
  builder: {
    label: "Builder",
    description: "Build Chat 对话助手，通过对话操作 Agent 资源",
    defaultAgentSlug: "build-chat",
    defaultAgentName: "Build Chat",
    defaultAgentIcon: "hammer",
    defaultModel: "anthropic/claude-sonnet-4",
    defaultTemperature: 0.3,
  },
  assist: {
    label: "Assist",
    description: "AI 辅助编辑器，用于提示词、代码、内容等的智能编辑",
    defaultAgentSlug: "assist",
    defaultAgentName: "AI 辅助编辑",
    defaultAgentIcon: "sparkles",
    defaultModel: "anthropic/claude-sonnet-4",
    defaultTemperature: 0.7,
  },
  evaluator: {
    label: "Evaluator",
    description: "Agent 评估，用于自动化测试和质量评估",
    defaultAgentSlug: "evaluator",
    defaultAgentName: "Evaluator",
    defaultAgentIcon: "flask-conical",
    defaultModel: "anthropic/claude-sonnet-4",
    defaultTemperature: 0.3,
  },
};
