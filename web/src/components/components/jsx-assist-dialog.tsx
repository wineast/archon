"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DefaultChatTransport, isTextUIPart, isToolUIPart, getToolName } from "ai";
import { useChat } from "@ai-sdk/react";
import type { UIMessage, UIDataTypes } from "ai";
import { CheckIcon, CopyIcon, InfoIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog as SubDialog,
  DialogContent as SubDialogContent,
  DialogHeader as SubDialogHeader,
  DialogTitle as SubDialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
} from "@/components/ai-elements/tool";
import { JsEditor } from "@/components/editors/js-editor";

type JsxAssistTools = {
  update_jsx: { input: { content: string }; output: string };
  edit_jsx: { input: { old_text: string; new_text: string }; output: string };
};

type JsxAssistMessage = UIMessage<unknown, UIDataTypes, JsxAssistTools>;

interface JsxAssistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jsxSource: string;
  onApply: (newSource: string) => void;
  agentId?: string;
}

function buildSystemPrompt(currentJsx: string): string {
  return `你是一位专业的 React 组件开发工程师。你的任务是帮助用户编写和优化 JSX 组件代码。

当前编辑器中的组件代码如下：
<current_jsx>
${currentJsx}
</current_jsx>

## 组件架构

组件使用 ES module 格式，通过 \`archon:*\` 虚拟模块导入依赖，\`export default function\` 导出渲染函数。

\`\`\`jsx
import { useState } from "archon:react";
import { Badge } from "archon:ui";

export default function ({ tool, state, isLoading, isComplete, isError }) {
  return <div>...</div>;
}
\`\`\`

### 可用模块
- \`archon:react\`：React, useState, useMemo, useCallback, useEffect, useRef, Fragment
- \`archon:ui\`：Badge, Spinner, Table/TableBody/TableCell/TableHead/TableHeader/TableRow, Tooltip/TooltipContent/TooltipTrigger, CollapsibleSection, ResultHeader, ResultSection, RateSheetLinks, RateSheetPanel, SourceDocumentViewer
- \`archon:icons\`：ChevronRight, FileText
- \`archon:component/<key>\`：同 Agent 下其他组件（default export）

### Props
- tool: { name: string, input: object, output: any }
- state: "partial-call" | "call" | "result" | "error"
- isLoading: boolean（正在加载）
- isComplete: boolean（已完成）
- isError: boolean（出错）

### 样式
可直接使用 Tailwind CSS 类名。

### JSX 片段简写
如果不需要导入依赖，可以直接写 JSX 片段，系统会自动包装为 ES module。

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
5. 用中文回复用户的问题和说明`;
}

function formatMessagesForCopy(messages: UIMessage[]): string {
  return messages
    .map((msg) => {
      const role = msg.role === "user" ? "User" : "Assistant";
      const parts = (msg.parts ?? [])
        .map((part) => {
          if (isTextUIPart(part)) return part.text;
          if (isToolUIPart(part)) {
            const name = getToolName(part);
            return `[${name}] ${JSON.stringify(part.input, null, 2)}`;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n\n");
      return `## ${role}\n${parts}`;
    })
    .join("\n\n---\n\n");
}

function ChatMessages({ messages }: { messages: UIMessage[] }) {
  return (
    <>
      {messages.map((message) => (
        <Message from={message.role} key={message.id}>
          {message.parts?.map((part, i) => {
            if (isTextUIPart(part)) {
              return (
                <MessageContent key={`text-${i}`}>
                  <MessageResponse>{part.text}</MessageResponse>
                </MessageContent>
              );
            }
            if (isToolUIPart(part)) {
              const name = getToolName(part);
              const toolLabel: Record<string, string> = {
                update_jsx: "整体替换",
                edit_jsx: "局部编辑",
              };
              return (
                <Tool key={`tool-${i}`}>
                  <ToolHeader state={part.state} toolName={name} type="dynamic-tool" title={toolLabel[name] ?? name} />
                  <ToolContent>
                    <ToolInput input={part.input} />
                  </ToolContent>
                </Tool>
              );
            }
            return null;
          })}
        </Message>
      ))}
    </>
  );
}

export function JsxAssistDialog({
  open,
  onOpenChange,
  jsxSource,
  onApply,
  agentId,
}: JsxAssistDialogProps) {
  const [draftJsx, setDraftJsx] = useState(jsxSource);
  const [originalJsx, setOriginalJsx] = useState(jsxSource);
  const [input, setInput] = useState("");
  const draftJsxRef = useRef(draftJsx);
  draftJsxRef.current = draftJsx;

  const hasDiff = draftJsx !== originalJsx;
  const sessionIdRef = useRef<string | null>(null);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setDraftJsx(jsxSource);
        setOriginalJsx(jsxSource);
        draftJsxRef.current = jsxSource;
        sessionIdRef.current = null;
      }
      onOpenChange(nextOpen);
    },
    [jsxSource, onOpenChange]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/jsx-assist",
        body: () => {
          if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID();
          return {
            currentJsx: draftJsxRef.current,
            agentId,
            sessionId: sessionIdRef.current,
          };
        },
      }),
    [agentId]
  );

  const { messages, setMessages, sendMessage, status, addToolOutput } = useChat<JsxAssistMessage>({
    transport,
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "update_jsx") {
        const { content } = toolCall.input as JsxAssistTools["update_jsx"]["input"];
        setDraftJsx(content);
        draftJsxRef.current = content;
        addToolOutput({
          tool: "update_jsx",
          toolCallId: toolCall.toolCallId,
          output: "已更新",
        });
      } else if (toolCall.toolName === "edit_jsx") {
        const { old_text, new_text } = toolCall.input as JsxAssistTools["edit_jsx"]["input"];
        const current = draftJsxRef.current;
        if (current.includes(old_text)) {
          const updated = current.replace(old_text, new_text);
          setDraftJsx(updated);
          draftJsxRef.current = updated;
        }
        addToolOutput({
          tool: "edit_jsx",
          toolCallId: toolCall.toolCallId,
          output: current.includes(old_text) ? "已更新" : "未找到匹配文本",
        });
      }
    },
  });

  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraftJsx(jsxSource);
      setOriginalJsx(jsxSource);
      draftJsxRef.current = jsxSource;
      setMessages([]);
      setInput("");
    }
    prevOpenRef.current = open;
  }, [open, jsxSource, setMessages]);

  const isStreaming = status === "streaming" || status === "submitted";

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
    },
    []
  );

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  }, [input, sendMessage]);

  const handleApply = useCallback(() => {
    onApply(draftJsx);
    onOpenChange(false);
  }, [draftJsx, onApply, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const [copied, setCopied] = useState(false);
  const handleCopyMessages = useCallback(() => {
    navigator.clipboard.writeText(formatMessagesForCopy(messages));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [messages]);

  const [sysPromptOpen, setSysPromptOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex h-[80vh] w-[90vw] max-w-[calc(100%-2rem)] sm:max-w-7xl flex-col p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <DialogTitle>AI 辅助编辑组件</DialogTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setSysPromptOpen(true)}>
                <InfoIcon className="size-3" />
                系统提示词
              </Button>
              <SubDialog open={sysPromptOpen} onOpenChange={setSysPromptOpen}>
                <SubDialogContent className="max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0">
                  <SubDialogHeader className="border-b px-4 py-3">
                    <SubDialogTitle>系统提示词</SubDialogTitle>
                  </SubDialogHeader>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <pre className="whitespace-pre-wrap break-words p-4 text-xs font-mono leading-relaxed">
                      {buildSystemPrompt(draftJsx)}
                    </pre>
                  </div>
                </SubDialogContent>
              </SubDialog>
              {messages.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleCopyMessages}>
                  {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
                  {copied ? "已复制" : "复制对话"}
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <div className="relative flex w-1/2 flex-col border-r">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
              Diff
            </div>
            <div className="flex-1 min-h-0">
              {open && (
                <JsEditor
                  original={originalJsx}
                  value={draftJsx}
                  readOnly={isStreaming}
                  onChange={setDraftJsx}
                  className="h-full border-0"
                />
              )}
            </div>
            {isStreaming && (
              <div className="absolute inset-0 top-[33px] flex items-center justify-center bg-background/50">
                <Spinner className="size-5" />
              </div>
            )}
          </div>

          <div className="flex w-1/2 flex-col">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
              AI 助手
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              {messages.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  描述你想要的组件效果，AI 会帮你编写左侧 JSX 代码
                </div>
              ) : (
                <Conversation>
                  <ConversationContent>
                    <ChatMessages messages={messages} />
                  </ConversationContent>
                  <ConversationScrollButton />
                </Conversation>
              )}
              <div className="shrink-0 border-t p-3">
                <PromptInput onSubmit={handleSubmit}>
                  <PromptInputBody>
                    <PromptInputTextarea
                      onChange={handleTextChange}
                      placeholder="描述你想要的组件效果..."
                      value={input}
                    />
                  </PromptInputBody>
                  <PromptInputFooter>
                    <div className="flex-1" />
                    <PromptInputSubmit
                      disabled={!input.trim() || isStreaming}
                      status={isStreaming ? "streaming" : "ready"}
                    />
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-4 py-3">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!hasDiff}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
