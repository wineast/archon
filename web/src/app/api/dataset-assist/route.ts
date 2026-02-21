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
    currentData,
    datasetName,
    datasetDescription,
  }: {
    messages: UIMessage[];
    currentData: string;
    datasetName?: string;
    datasetDescription?: string;
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
          source: "dataset-assist",
        });
      });
    },
    system: `你是一位专业的数据编辑助手。你的任务是帮助用户编写和优化数据集内容。

当前编辑器中的数据如下：
<current_data>
${currentData}
</current_data>

${datasetName ? `## 数据集名称\n\n${datasetName}\n\n` : ""}${datasetDescription ? `## 数据集描述\n\n${datasetDescription}\n\n` : ""}## 数据格式

数据可以是有效的 JSON，也可以包含 LiquidJS 模板语法（\`{{var}}\`、\`{% %}\`）。

### JSON 模式
当数据是纯 JSON 时，保持有效的 JSON 结构。

### 模板模式
当数据包含 LiquidJS 模板语法时，保持模板语法不变，只修改数据内容部分。

### 常见数据模式
- 简单值：\`"text"\`
- 对象：\`{"key": "value"}\`
- 数组：\`["item1", "item2"]\`
- 嵌套条目对象：\`{"entry1": {"field": "value"}, "entry2": {"field": "value"}}\`

## 可用工具

### update_data — 整体替换
适用于大范围重写或重新组织。必须提供完整的数据字符串。

### edit_data — 局部编辑
适用于小范围修改。提供 old_text（要匹配的原文片段）和 new_text（替换后的内容）。

## 工作规则
1. 小范围修改优先使用 edit_data，避免不必要的整体替换
2. 大范围重写或结构调整使用 update_data
3. edit_data 的 old_text 必须与当前数据文本精确匹配（包括空格和换行）
4. JSON 模式下确保输出是合法的 JSON
5. 模板模式下保持 LiquidJS 语法不变
6. 用中文回复用户的问题和说明`,
    tools: {
      update_data: tool({
        description: "整体替换编辑器中的数据。适用于大范围重写。",
        inputSchema: z.object({
          content: z.string().describe("完整的更新后数据字符串"),
        }),
      }),
      edit_data: tool({
        description: "局部编辑数据。在当前内容中找到 old_text 并替换为 new_text。",
        inputSchema: z.object({
          old_text: z.string().describe("要匹配的原文片段，必须精确匹配"),
          new_text: z.string().describe("替换后的内容。为空字符串表示删除"),
        }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
