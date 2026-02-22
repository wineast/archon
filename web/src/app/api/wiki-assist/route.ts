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
import { getOrgAssistModel } from "@/lib/orgs/build-chat-settings";
import { QuotaExceededError } from "@/lib/credits/errors";

export const maxDuration = 30;

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const {
    messages,
    currentContent,
    documentName,
    agentId,
  }: {
    messages: UIMessage[];
    currentContent: string;
    documentName?: string;
    agentId?: string;
  } = await req.json();

  const currentUserId = authResult.id;
  const orgId = await getOrgIdByAgentId(agentId);
  const modelId = orgId ? await getOrgAssistModel(orgId) : "anthropic/claude-sonnet-4";

  let model;
  try {
    model = await resolveModel(modelId, orgId);
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
          modelId,
          usage: {
            inputTokens: totalUsage.inputTokens,
            outputTokens: totalUsage.outputTokens,
            cachedInputTokens: totalUsage.cachedInputTokens,
            reasoningTokens: totalUsage.reasoningTokens,
          },
          source: "wiki-assist",
        });
      });
    },
    system: `你是一位专业的文档编辑助手，帮助用户编写和优化 Wiki 文档。

当前编辑的文档${documentName ? `「${documentName}」` : ""}内容如下：
<current_content>
${currentContent}
</current_content>

## 内容格式
文档内容为 Markdown 格式，可包含 LiquidJS 模板语法：
- 变量：{{variable}}、{{lookup.xxx}}
- 条件：{% if condition %}...{% endif %}
- 循环：{% for item in list %}...{% endfor %}
- 引用：{% include 'doc_name' %}

## 可用工具
你有两个工具可以修改编辑器内容：

### update_content — 整体替换
适用于大范围重写或重新组织。必须提供完整的新文档内容。

### edit_content — 局部编辑
适用于小范围修改（插入、替换、删除局部内容）。提供 old_text（要匹配的原文片段）和 new_text（替换后的内容）。
- 替换：old_text 和 new_text 都不为空
- 删除：new_text 为空字符串
- 插入：将 old_text 设为插入位置前后的已有文本，new_text 为该文本加上要插入的内容

## 工作规则
1. 小范围修改优先使用 edit_content，避免不必要的整体替换
2. 大范围重写或结构调整使用 update_content
3. edit_content 的 old_text 必须与当前文档中的文本精确匹配（包括空格和换行）
4. 编辑时保持模板语法不变（如 {{变量}}、{% include '文档' %}、{{lookup.xxx}} 等 LiquidJS 语法）
5. 用中文回复用户的问题和说明`,
    tools: {
      update_content: tool({
        description: "整体替换编辑器中的文档内容。适用于大范围重写。",
        inputSchema: z.object({
          content: z.string().describe("完整的更新后文档内容"),
        }),
      }),
      edit_content: tool({
        description: "局部编辑文档。在当前内容中找到 old_text 并替换为 new_text。",
        inputSchema: z.object({
          old_text: z.string().describe("要匹配的原文片段，必须精确匹配"),
          new_text: z.string().describe("替换后的内容。为空字符串表示删除"),
        }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
