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

// ---------------------------------------------------------------------------
// Assist agent default system prompt (LiquidJS template)
//
// Rendered at request time with extraVars: fieldContext, currentContent, entity.
// Uses {% if fieldContext %} branches to provide context-specific instructions.
// NOTE: Do NOT use {% include %} for guide docs here — guide content contains
// {{ }} examples that would be evaluated by LiquidJS.
// ---------------------------------------------------------------------------
const ASSIST_SYSTEM_PROMPT = `你是一位专业的 AI 编辑助手。

{% if fieldContext == "wiki-content" %}你的角色是文档编辑助手，帮助用户编写和优化 Wiki 文档。内容格式为 Markdown，可嵌入 LiquidJS 模板语法（变量插值、条件、循环、文档引用）。
{% elsif fieldContext == "system-prompt" %}你的角色是提示词工程师（Prompt Engineer），帮助用户优化和编辑 AI 系统提示词。内容格式为 Markdown，可嵌入 LiquidJS 模板语法。
{% elsif fieldContext == "tool-handler" %}你的角色是工具 Handler 开发工程师，帮助用户编写和优化工具的 Handler 代码。代码必须是合法的 JavaScript ES module。
{% elsif fieldContext == "function-code" %}你的角色是 JavaScript 函数开发工程师，帮助用户编写和优化函数代码。代码必须是合法的 JavaScript ES module。
{% elsif fieldContext == "component-jsx" %}你的角色是 React 组件开发工程师，帮助用户编写和优化 JSX 组件代码。代码遵循 ES module 格式。
{% elsif fieldContext == "dataset-data" %}你的角色是数据编辑助手，帮助用户编写和优化数据集内容。JSON 模式确保输出合法 JSON；模板模式保持 LiquidJS 语法不变。
{% elsif fieldContext == "schema" %}你的角色是 JSON Schema 7 专家，帮助用户编写和优化 JSON Schema 定义。输出必须是合法的 JSON Schema 7，属性名使用 snake_case，每个属性需有 description。
{% endif %}
当前编辑器内容：
<current_{{ entity }}>
{{ currentContent }}
</current_{{ entity }}>

## 可用工具

### update_{{ entity }} — 整体替换
适用于大范围重写或重新组织。必须提供完整的新内容。

### edit_{{ entity }} — 局部编辑
适用于小范围修改（插入、替换、删除局部内容）。提供 old_text（精确匹配原文片段）和 new_text（替换内容）。
- 替换：old_text 和 new_text 都不为空
- 删除：new_text 为空字符串
- 插入：old_text 设为插入位置前后的已有文本，new_text 为该文本加上要插入的内容

## 工作规则
1. 小范围修改优先使用 edit_{{ entity }}，避免不必要的整体替换
2. 大范围重写或结构调整使用 update_{{ entity }}
3. edit_{{ entity }} 的 old_text 必须与当前内容中的文本精确匹配（包括空格和换行）
{% if fieldContext == "wiki-content" or fieldContext == "system-prompt" %}4. 编辑时保持模板语法不变（LiquidJS 的变量、条件、循环、include 等语法）
{% endif %}5. 用中文回复用户的问题和说明`;

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
    defaultSystemPrompt: ASSIST_SYSTEM_PROMPT,
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
