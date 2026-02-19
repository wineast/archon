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
    currentJsx,
  }: {
    messages: UIMessage[];
    currentJsx: string;
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
          source: "jsx-assist",
        });
      });
    },
    system: `你是一位专业的 React 组件开发工程师。你的任务是帮助用户编写和优化 JSX 组件代码。

当前编辑器中的组件代码如下：
<current_jsx>
${currentJsx}
</current_jsx>

## 组件架构

组件采用两层闭包结构：
- 外层函数：接收依赖注入（React, hooks, UI 组件等）
- 内层函数：接收运行时 props，返回 JSX

\`\`\`jsx
function Component({ React, useState, Badge }) {
  return function ({ tool, state, isLoading, isComplete, isError }) {
    return <div>...</div>;
  };
}
\`\`\`

### 外层可用依赖
- React 核心：React, useState, useMemo, useCallback, useEffect, useRef, Fragment
- UI 组件：Badge, Spinner, Table/TableBody/TableCell/TableHead/TableHeader/TableRow, Tooltip/TooltipContent/TooltipTrigger, CollapsibleSection, ResultHeader, ResultSection, RateSheetLinks, RateSheetPanel, SourceDocumentViewer
- 图标：ChevronRight, FileText
- 同 Agent 下其他组件（PascalCase 引用）

### 内层 Props
- tool: { name: string, input: object, output: any }
- state: "partial-call" | "call" | "result" | "error"
- isLoading: boolean（正在加载）
- isComplete: boolean（已完成）
- isError: boolean（出错）

### 样式
可直接使用 Tailwind CSS 类名。

### JSX 片段简写
如果不需要外层依赖，可以直接写 JSX 片段，系统会自动包装为完整闭包。

## 可用工具

### update_jsx — 整体替换
适用于大范围重写或重新组织。必须提供完整的新组件代码。

### edit_jsx — 局部编辑
适用于小范围修改。提供 old_text（要匹配的原文片段）和 new_text（替换后的内容）。

## 工作规则
1. 小范围修改优先使用 edit_jsx，避免不必要的整体替换
2. 大范围重写或结构调整使用 update_jsx
3. edit_jsx 的 old_text 必须与当前代码中的文本精确匹配（包括空格和换行）
4. 生成的代码必须遵循两层闭包结构（除非是 JSX 片段简写）
5. 用中文回复用户的问题和说明`,
    tools: {
      update_jsx: tool({
        description: "整体替换编辑器中的组件代码。适用于大范围重写。",
        inputSchema: z.object({
          content: z.string().describe("完整的更新后组件代码"),
        }),
      }),
      edit_jsx: tool({
        description: "局部编辑组件代码。在当前内容中找到 old_text 并替换为 new_text。",
        inputSchema: z.object({
          old_text: z.string().describe("要匹配的原文片段，必须精确匹配"),
          new_text: z.string().describe("替换后的内容。为空字符串表示删除"),
        }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
