import {
  streamText,
  gateway,
  tool,
  UIMessage,
  convertToModelMessages,
} from "ai";
import { z } from "zod";
import { after } from "next/server";
import { requireAuth } from "@/lib/auth/require-agent-role";
import { NextResponse } from "next/server";
import { recordUsage } from "@/lib/usage/record";

export const maxDuration = 30;

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const {
    messages,
    currentSchema,
    context,
  }: {
    messages: UIMessage[];
    currentSchema: string;
    context?: string;
  } = await req.json();

  const currentUserId = authResult.id;

  const result = streamText({
    model: gateway("claude-sonnet-4-20250514"),
    messages: await convertToModelMessages(messages),
    onFinish: ({ totalUsage }) => {
      after(async () => {
        await recordUsage({
          orgId: null,
          agentId: null,
          userId: currentUserId,
          sessionId: null,
          modelId: "claude-sonnet-4-20250514",
          usage: {
            inputTokens: totalUsage.inputTokens,
            outputTokens: totalUsage.outputTokens,
            cachedInputTokens: totalUsage.cachedInputTokens,
            reasoningTokens: totalUsage.reasoningTokens,
          },
          source: "schema-code-assist",
        });
      });
    },
    system: `你是一位专业的 JSON Schema 7 专家。你的任务是帮助用户编写和优化 JSON Schema 定义。

当前编辑器中的 JSON Schema 如下：
<current_schema>
${currentSchema}
</current_schema>

${context ? `## Schema 上下文\n\n${context}\n\n` : ""}## JSON Schema 7 规范

Schema 定义使用标准 JSON Schema 7 格式，用于描述工具参数、函数参数或对象类型的数据结构。

### 基本结构
\`\`\`json
{
  "type": "object",
  "properties": {
    "field_name": { "type": "string", "description": "字段描述" }
  },
  "required": ["field_name"]
}
\`\`\`

### 支持的类型
- string（支持 minLength, maxLength, pattern, format, enum）
- integer / number（支持 minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf）
- boolean
- object（支持 properties, required, additionalProperties）
- array（支持 items, prefixItems, minItems, maxItems, uniqueItems）
- null

### 组合与引用
- \`$ref\`: 引用其他 Schema，格式 \`"$ref": "#/$defs/schema_key"\`
- \`allOf\`: 合并多个 Schema 的属性
- \`oneOf\` / \`anyOf\`: 联合类型
- \`anyOf: [T, {"type":"null"}]\`: 表示 nullable

### Archon 扩展字段
- \`x-discriminator\`: 联合类型的判别字段名
- \`x-discriminatorValues\`: 每个变体的判别值
- \`x-unionMode\`: "oneOf" 或 "anyOf"

### 模板字符串
在 enum 中可以使用数据集变量：
\`\`\`json
{ "enum": ["{{dataset_key}}"] }
\`\`\`
运行时会展开为数据集中的实际值列表。

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
    tools: {
      update_schema: tool({
        description: "整体替换编辑器中的 JSON Schema。适用于大范围重写。",
        inputSchema: z.object({
          content: z.string().describe("完整的更新后 JSON Schema JSON 字符串"),
        }),
      }),
      edit_schema: tool({
        description: "局部编辑 JSON Schema。在当前内容中找到 old_text 并替换为 new_text。",
        inputSchema: z.object({
          old_text: z.string().describe("要匹配的原文片段，必须精确匹配"),
          new_text: z.string().describe("替换后的内容。为空字符串表示删除"),
        }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
