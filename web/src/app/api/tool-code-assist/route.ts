import type { UIMessage } from "ai";
import { createAssistHandler, buildAssistTools } from "@/lib/ai/assist-utils";
import toolHandlerGuide from "../../../../guide/tool-handler.md";

export const maxDuration = 30;

export const POST = createAssistHandler({
  source: "tool-code-assist",
  buildParams: (body) => {
    const { messages, currentCode, toolName, toolDescription, agentId } = body as {
      messages: UIMessage[];
      currentCode: string;
      toolName?: string;
      toolDescription?: string;
      agentId?: string;
    };

    const toolContext = [
      toolName && `工具名称：${toolName}`,
      toolDescription && `工具描述：${toolDescription}`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      messages,
      agentId,
      system: `你是一位专业的工具 Handler 开发工程师。你的任务是帮助用户编写和优化工具的 Handler 代码。

当前编辑器中的 Handler 代码如下：
<current_code>
${currentCode}
</current_code>

${toolContext ? `## 工具信息\n\n${toolContext}\n\n` : ""}## 编辑参考
${toolHandlerGuide}

## 可用工具

### update_code — 整体替换
适用于大范围重写或重新组织。必须提供完整的新 Handler 代码。

### edit_code — 局部编辑
适用于小范围修改。提供 old_text（要匹配的原文片段）和 new_text（替换后的内容）。

## 工作规则
1. 小范围修改优先使用 edit_code，避免不必要的整体替换
2. 大范围重写或结构调整使用 update_code
3. edit_code 的 old_text 必须与当前代码中的文本精确匹配（包括空格和换行）
4. 代码必须是合法的 JavaScript，使用 ES module 格式
5. 用中文回复用户的问题和说明`,
    };
  },
  tools: buildAssistTools("code"),
});
