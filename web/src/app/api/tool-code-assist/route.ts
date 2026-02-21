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
    currentCode,
    toolName,
    toolDescription,
  }: {
    messages: UIMessage[];
    currentCode: string;
    toolName?: string;
    toolDescription?: string;
  } = await req.json();

  const currentUserId = authResult.id;

  const toolContext = [
    toolName && `工具名称：${toolName}`,
    toolDescription && `工具描述：${toolDescription}`,
  ]
    .filter(Boolean)
    .join("\n");

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
          source: "tool-code-assist",
        });
      });
    },
    system: `你是一位专业的工具 Handler 开发工程师。你的任务是帮助用户编写和优化工具的 Handler 代码。

当前编辑器中的 Handler 代码如下：
<current_code>
${currentCode}
</current_code>

${toolContext ? `## 工具信息\n\n${toolContext}\n\n` : ""}## Handler 架构

Handler 是一个异步函数，签名为 \`async (args, context) => result\`：

\`\`\`javascript
async (args, context) => {
  // args — 工具定义的 parameters 解析后的对象
  // context — 运行时数据访问 API
  // 返回值为任意可序列化的 JSON 对象
  return { result: "..." };
}
\`\`\`

## Context API

### context.wiki
\`\`\`javascript
const doc = await context.wiki.get("key-or-id");    // { meta, content }
const docs = await context.wiki.findByPrefix("prefix-");  // [{ id, title, meta, content }]
const results = await context.wiki.search("关键词");       // [{ id, title, meta, content }]
\`\`\`

### context.dataset
\`\`\`javascript
const val = await context.dataset.get("company_name");       // "GMCC" | null
const entries = await context.dataset.getEntries("products"); // [{ value, label, metadata }]
\`\`\`

### context.fn(key)
\`\`\`javascript
const calc = await context.fn("calculate_price");
const result = await calc({ quantity: 10 });
\`\`\`

### context.ontology
\`\`\`javascript
const types = await context.ontology.types();
const type = await context.ontology.type("customer");
const items = await context.ontology.query("customer", { city: "北京" });
const item = await context.ontology.get("customer", id);
const created = await context.ontology.create("customer", { name: "张三" });
await context.ontology.update("customer", id, data);
await context.ontology.delete("customer", id);
await context.ontology.link(sourceId, "has_order", targetId);
await context.ontology.unlink(sourceId, "has_order", targetId);
const graph = await context.ontology.graph("customer", id, { depth: 2 });
\`\`\`

## 可用工具

### update_code — 整体替换
适用于大范围重写或重新组织。必须提供完整的新 Handler 代码。

### edit_code — 局部编辑
适用于小范围修改。提供 old_text（要匹配的原文片段）和 new_text（替换后的内容）。

## 工作规则
1. 小范围修改优先使用 edit_code，避免不必要的整体替换
2. 大范围重写或结构调整使用 update_code
3. edit_code 的 old_text 必须与当前代码中的文本精确匹配（包括空格和换行）
4. 代码必须是合法的 JavaScript
5. Handler 必须是 \`async (args, context) => { ... }\` 格式的箭头函数
6. 用中文回复用户的问题和说明`,
    tools: {
      update_code: tool({
        description: "整体替换编辑器中的 Handler 代码。适用于大范围重写。",
        inputSchema: z.object({
          content: z.string().describe("完整的更新后 Handler 代码"),
        }),
      }),
      edit_code: tool({
        description:
          "局部编辑 Handler 代码。在当前内容中找到 old_text 并替换为 new_text。",
        inputSchema: z.object({
          old_text: z.string().describe("要匹配的原文片段，必须精确匹配"),
          new_text: z.string().describe("替换后的内容。为空字符串表示删除"),
        }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
