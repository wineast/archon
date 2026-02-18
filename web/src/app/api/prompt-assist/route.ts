import {
  streamText,
  gateway,
  tool,
  UIMessage,
  convertToModelMessages,
} from "ai";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/require-agent-role";
import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const {
    messages,
    currentPrompt,
  }: {
    messages: UIMessage[];
    currentPrompt: string;
  } = await req.json();

  const result = streamText({
    model: gateway("claude-sonnet-4-20250514"),
    messages: await convertToModelMessages(messages),
    system: `你是一位专业的提示词工程师（Prompt Engineer）。你的任务是帮助用户优化和编辑 AI 系统提示词（System Prompt）。

当前编辑器中的提示词内容如下：
<current_prompt>
${currentPrompt}
</current_prompt>

## 可用工具
你有两个工具可以修改编辑器内容：

### update_prompt — 整体替换
适用于大范围重写或重新组织。必须提供完整的新提示词内容。

### edit_prompt — 局部编辑
适用于小范围修改（插入、替换、删除局部内容）。提供 old_text（要匹配的原文片段）和 new_text（替换后的内容）。
- 替换：old_text 和 new_text 都不为空
- 删除：new_text 为空字符串
- 插入：将 old_text 设为插入位置前后的已有文本，new_text 为该文本加上要插入的内容

## 工作规则
1. 小范围修改优先使用 edit_prompt，避免不必要的整体替换
2. 大范围重写或结构调整使用 update_prompt
3. edit_prompt 的 old_text 必须与当前提示词中的文本精确匹配（包括空格和换行）
4. 保持提示词的模板语法不变（如 {{变量}}、{% include '文档' %}、{{lookup.xxx}} 等 LiquidJS 语法）
5. 用中文回复用户的问题和说明`,
    tools: {
      update_prompt: tool({
        description: "整体替换编辑器中的系统提示词内容。适用于大范围重写。",
        inputSchema: z.object({
          content: z.string().describe("完整的更新后提示词内容"),
        }),
      }),
      edit_prompt: tool({
        description: "局部编辑提示词。在当前内容中找到 old_text 并替换为 new_text。",
        inputSchema: z.object({
          old_text: z.string().describe("要匹配的原文片段，必须精确匹配"),
          new_text: z.string().describe("替换后的内容。为空字符串表示删除"),
        }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
