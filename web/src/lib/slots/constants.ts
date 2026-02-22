import type { SlotKey } from "@/db/schema";

export interface SlotDef {
  label: string;
  description: string;
  defaultAgentSlug: string;
  defaultAgentName: string;
  defaultAgentIcon: string;
  defaultModel: string;
  defaultSystemPrompt: string;
  defaultTemperature: number;
}

export const SLOT_DEFS: Record<SlotKey, SlotDef> = {
  builder: {
    label: "Builder",
    description: "Build Chat 对话助手，通过对话操作 Agent 资源",
    defaultAgentSlug: "build-chat",
    defaultAgentName: "Build Chat",
    defaultAgentIcon: "hammer",
    defaultModel: "",
    defaultSystemPrompt: "",
    defaultTemperature: 0.3,
  },
  assist: {
    label: "Assist",
    description: "AI 辅助编辑器，用于提示词、代码、内容等的智能编辑",
    defaultAgentSlug: "assist",
    defaultAgentName: "AI 辅助编辑",
    defaultAgentIcon: "sparkles",
    defaultModel: "",
    defaultSystemPrompt: "",
    defaultTemperature: 0.7,
  },
  evaluator: {
    label: "Evaluator",
    description: "Agent 评估，用于自动化测试和质量评估",
    defaultAgentSlug: "evaluator",
    defaultAgentName: "Evaluator",
    defaultAgentIcon: "flask-conical",
    defaultModel: "",
    defaultSystemPrompt:
      "You are a judge evaluating AI assistant responses.\n\nYou will receive the user input, expected output (if any), and the actual response.\nEvaluate the response on each of the following dimensions, scoring from 1 to 10.\n\nFor each dimension, return a JSON object with the dimension key mapped to { \"score\": <1-10>, \"reason\": \"<brief explanation>\" }.",
    defaultTemperature: 0.3,
  },
  support: {
    label: "Support",
    description: "客服聊天气泡，帮助用户了解和使用功能",
    defaultAgentSlug: "support",
    defaultAgentName: "Support",
    defaultAgentIcon: "headset",
    defaultModel: "",
    defaultSystemPrompt:
      "You are a friendly support assistant embedded in the application. Help users understand features, answer questions, and guide them through common tasks. Be concise, helpful, and proactive in suggesting relevant actions.",
    defaultTemperature: 0.7,
  },
};
