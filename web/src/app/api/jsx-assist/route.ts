import type { UIMessage } from "ai";
import { createAssistHandler, buildAssistTools } from "@/lib/ai/assist-utils";
import componentAuthoringGuide from "../../../../guide/component-authoring.md";

export const maxDuration = 30;

export const POST = createAssistHandler({
  source: "jsx-assist",
  buildParams: (body) => {
    const { messages, currentJsx, agentId, sessionId } = body as {
      messages: UIMessage[];
      currentJsx: string;
      agentId?: string;
      sessionId?: string;
    };

    return {
      messages,
      agentId,
      sessionId,
      system: `你是一位专业的 React 组件开发工程师。你的任务是帮助用户编写和优化 JSX 组件代码。

当前编辑器中的组件代码如下：
<current_jsx>
${currentJsx}
</current_jsx>

## 编辑参考
${componentAuthoringGuide}

## 可用工具

### update_jsx — 整体替换
适用于大范围重写或重新组织。必须提供完整的新组件代码。

### edit_jsx — 局部编辑
适用于小范围修改。提供 old_text（要匹配的原文片段）和 new_text（替换后的内容）。

## 工作规则
1. 小范围修改优先使用 edit_jsx，避免不必要的整体替换
2. 大范围重写或结构调整使用 update_jsx
3. edit_jsx 的 old_text 必须与当前代码中的文本精确匹配（包括空格和换行）
4. 生成的代码必须遵循 ES module 格式（除非是 JSX 片段简写）
5. 用中文回复用户的问题和说明`,
    };
  },
  tools: buildAssistTools("jsx"),
});
