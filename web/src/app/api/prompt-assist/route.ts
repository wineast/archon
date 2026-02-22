import type { UIMessage } from "ai";
import { createAssistHandler, buildAssistTools } from "@/lib/ai/assist-utils";
import promptEditingGuide from "../../../../guide/prompt-editing.md";

export const maxDuration = 30;

export const POST = createAssistHandler({
  source: "prompt-assist",
  buildParams: (body) => {
    const { messages, currentPrompt, agentId } = body as {
      messages: UIMessage[];
      currentPrompt: string;
      agentId?: string;
    };

    return {
      messages,
      agentId,
      system: `你是一位专业的提示词工程师（Prompt Engineer）。你的任务是帮助用户优化和编辑 AI 系统提示词（System Prompt）。

当前编辑器中的提示词内容如下：
<current_prompt>
${currentPrompt}
</current_prompt>

## 编辑参考
${promptEditingGuide}

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
4. 保持提示词的模板语法不变（如 {{变量}}、{% include '文档' %} 等 LiquidJS 语法）
5. 用中文回复用户的问题和说明`,
    };
  },
  tools: buildAssistTools("prompt"),
});
