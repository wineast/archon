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
import { MdEditor } from "@/components/editors/md-editor";

type PromptAssistTools = {
  update_prompt: { input: { content: string }; output: string };
  edit_prompt: { input: { old_text: string; new_text: string }; output: string };
};

type PromptAssistMessage = UIMessage<unknown, UIDataTypes, PromptAssistTools>;

interface PromptAssistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  systemPrompt: string;
  onApply: (newPrompt: string) => void;
  agentId?: string;
}

function buildSystemPrompt(currentPrompt: string): string {
  return `你是一位专业的提示词工程师（Prompt Engineer）。你的任务是帮助用户优化和编辑 AI 系统提示词（System Prompt）。

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
                update_prompt: "整体替换",
                edit_prompt: "局部编辑",
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

export function PromptAssistDialog({
  open,
  onOpenChange,
  systemPrompt,
  onApply,
  agentId,
}: PromptAssistDialogProps) {
  const [draftPrompt, setDraftPrompt] = useState(systemPrompt);
  const [originalPrompt, setOriginalPrompt] = useState(systemPrompt);
  const [input, setInput] = useState("");
  const draftPromptRef = useRef(draftPrompt);
  draftPromptRef.current = draftPrompt;

  const hasDiff = draftPrompt !== originalPrompt;
  const sessionIdRef = useRef<string | null>(null);

  // Reset state when dialog opens
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setDraftPrompt(systemPrompt);
        setOriginalPrompt(systemPrompt);
        draftPromptRef.current = systemPrompt;
        sessionIdRef.current = null;
      }
      onOpenChange(nextOpen);
    },
    [systemPrompt, onOpenChange]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/prompt-assist",
        body: () => {
          if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID();
          return {
            currentPrompt: draftPromptRef.current,
            agentId,
            sessionId: sessionIdRef.current,
          };
        },
      }),
    [agentId]
  );

  const { messages, setMessages, sendMessage, status, addToolOutput } = useChat<PromptAssistMessage>({
    transport,
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "update_prompt") {
        const { content } = toolCall.input as PromptAssistTools["update_prompt"]["input"];
        setDraftPrompt(content);
        draftPromptRef.current = content;
        addToolOutput({
          tool: "update_prompt",
          toolCallId: toolCall.toolCallId,
          output: "已更新",
        });
      } else if (toolCall.toolName === "edit_prompt") {
        const { old_text, new_text } = toolCall.input as PromptAssistTools["edit_prompt"]["input"];
        const current = draftPromptRef.current;
        if (current.includes(old_text)) {
          const updated = current.replace(old_text, new_text);
          setDraftPrompt(updated);
          draftPromptRef.current = updated;
        }
        addToolOutput({
          tool: "edit_prompt",
          toolCallId: toolCall.toolCallId,
          output: current.includes(old_text) ? "已更新" : "未找到匹配文本",
        });
      }
    },
  });

  // Reset all state when dialog opens
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraftPrompt(systemPrompt);
      setOriginalPrompt(systemPrompt);
      draftPromptRef.current = systemPrompt;
      setMessages([]);
      setInput("");
    }
    prevOpenRef.current = open;
  }, [open, systemPrompt, setMessages]);

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
    onApply(draftPrompt);
    onOpenChange(false);
  }, [draftPrompt, onApply, onOpenChange]);

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
            <DialogTitle>AI 辅助编辑提示词</DialogTitle>
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
                      {buildSystemPrompt(draftPrompt)}
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
          {/* Left: Diff Editor */}
          <div className="relative flex w-1/2 flex-col border-r">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
              Diff
            </div>
            <div className="flex-1 min-h-0">
              {open && (
                <MdEditor
                  original={originalPrompt}
                  value={draftPrompt}
                  readOnly={isStreaming}
                  onChange={setDraftPrompt}
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

          {/* Right: AI Chat */}
          <div className="flex w-1/2 flex-col">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
              AI 助手
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              {messages.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  描述你想要的修改，AI 会帮你更新左侧提示词
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
                      placeholder="描述你想要的修改..."
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
