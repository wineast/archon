import {
  streamText,
  tool,
  UIMessage,
  convertToModelMessages,
} from "ai";
import { z } from "zod";
import { after } from "next/server";
import { requireAuth } from "@/lib/auth/require-agent-role";
import { NextResponse } from "next/server";
import { recordUsage } from "@/lib/usage/record";
import { resolveModel } from "@/lib/ai/resolve-model";
import { getOrgIdByAgentId } from "@/lib/ai/get-org-id";
import { QuotaExceededError } from "@/lib/credits/errors";

const MODEL_ID = "anthropic/claude-sonnet-4-20250514";

export const maxDuration = 30;

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const {
    messages,
    currentCode,
    context,
    agentId,
  }: {
    messages: UIMessage[];
    currentCode: string;
    context?: string;
    agentId?: string;
  } = await req.json();

  const currentUserId = authResult.id;
  const orgId = await getOrgIdByAgentId(agentId);

  let model;
  try {
    model = await resolveModel(MODEL_ID, orgId);
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return Response.json({ error: "quota_exceeded", message: e.message }, { status: 402 });
    }
    throw e;
  }

  const result = streamText({
    model,
    messages: await convertToModelMessages(messages),
    onFinish: ({ totalUsage }) => {
      after(async () => {
        await recordUsage({
          orgId,
          agentId: agentId ?? null,
          userId: currentUserId,
          sessionId: null,
          modelId: MODEL_ID,
          usage: {
            inputTokens: totalUsage.inputTokens,
            outputTokens: totalUsage.outputTokens,
            cachedInputTokens: totalUsage.cachedInputTokens,
            reasoningTokens: totalUsage.reasoningTokens,
          },
          source: "function-code-assist",
        });
      });
    },
    system: `你是一位专业的 JavaScript 函数开发工程师。你的任务是帮助用户编写和优化函数代码。

当前编辑器中的函数代码如下：
<current_code>
${currentCode}
</current_code>

${context ? `## 函数上下文\n\n${context}\n\n` : ""}## 函数架构

函数运行在沙箱环境中，接收参数对象并返回结果。代码格式如下：

\`\`\`javascript
// 函数接收 params 对象，包含定义的参数
// 返回值会被序列化为 JSON 返回给调用方
const { param1, param2 } = params;

// 处理逻辑...

return { result: "..." };
\`\`\`

### 运行环境
- JavaScript 沙箱（不能使用 import/require）
- 可以使用标准 JavaScript 内置对象（Math, Date, JSON, RegExp 等）
- params 对象包含调用时传入的参数
- 通过 return 语句返回结果

## 可用工具

### update_code — 整体替换
适用于大范围重写或重新组织。必须提供完整的新函数代码。

### edit_code — 局部编辑
适用于小范围修改。提供 old_text（要匹配的原文片段）和 new_text（替换后的内容）。

## 工作规则
1. 小范围修改优先使用 edit_code，避免不必要的整体替换
2. 大范围重写或结构调整使用 update_code
3. edit_code 的 old_text 必须与当前代码中的文本精确匹配（包括空格和换行）
4. 代码必须是合法的 JavaScript，不能使用 import/require
5. 用中文回复用户的问题和说明`,
    tools: {
      update_code: tool({
        description: "整体替换编辑器中的函数代码。适用于大范围重写。",
        inputSchema: z.object({
          content: z.string().describe("完整的更新后函数代码"),
        }),
      }),
      edit_code: tool({
        description: "局部编辑函数代码。在当前内容中找到 old_text 并替换为 new_text。",
        inputSchema: z.object({
          old_text: z.string().describe("要匹配的原文片段，必须精确匹配"),
          new_text: z.string().describe("替换后的内容。为空字符串表示删除"),
        }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
