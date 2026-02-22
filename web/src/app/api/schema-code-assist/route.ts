import type { UIMessage } from "ai";
import { createAssistHandler, buildAssistTools } from "@/lib/ai/assist-utils";
import schemaGuide from "../../../../guide/schema.md";

export const maxDuration = 30;

export const POST = createAssistHandler({
  source: "schema-code-assist",
  buildParams: (body) => {
    const { messages, currentSchema, context, agentId } = body as {
      messages: UIMessage[];
      currentSchema: string;
      context?: string;
      agentId?: string;
    };

    return {
      messages,
      agentId,
      system: `你是一位专业的 JSON Schema 7 专家。你的任务是帮助用户编写和优化 JSON Schema 定义。

当前编辑器中的 JSON Schema 如下：
<current_schema>
${currentSchema}
</current_schema>

${context ? `## Schema 上下文\n\n${context}\n\n` : ""}## 编辑参考
${schemaGuide}

## 可用工具

### update_schema — 整体替换
适用于大范围重写或重新组织。必须提供完整的 JSON Schema JSON 字符串。

### edit_schema — 局部编辑
适用于小范围修改。提供 old_text（要匹配的原文片段）和 new_text（替换后的内容）。

## 工作规则
1. 小范围修改优先使用 edit_schema，避免不必要的整体替换
2. 大范围重写或结构调整使用 update_schema
3. edit_schema 的 old_text 必须与当前 JSON Schema 文本精确匹配（包括空格和换行）
4. 输出必须是合法的 JSON Schema 7
5. 属性名使用 snake_case
6. 每个属性都应该有 description
7. 用中文回复用户的问题和说明`,
    };
  },
  tools: buildAssistTools("schema"),
});
