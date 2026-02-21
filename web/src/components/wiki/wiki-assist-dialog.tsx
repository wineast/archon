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

type WikiAssistTools = {
  update_content: { input: { content: string }; output: string };
  edit_content: { input: { old_text: string; new_text: string }; output: string };
};

type WikiAssistMessage = UIMessage<unknown, UIDataTypes, WikiAssistTools>;

interface WikiAssistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  documentName?: string;
  onApply: (newContent: string) => void;
}

function buildSystemPrompt(currentContent: string, documentName?: string): string {
  return `你是一位专业的文档编辑助手，帮助用户编写和优化 Wiki 文档。

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
                update_content: "整体替换",
                edit_content: "局部编辑",
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

export function WikiAssistDialog({
  open,
  onOpenChange,
  content,
  documentName,
  onApply,
}: WikiAssistDialogProps) {
  const [draftContent, setDraftContent] = useState(content);
  const [originalContent, setOriginalContent] = useState(content);
  const [input, setInput] = useState("");
  const draftContentRef = useRef(draftContent);
  draftContentRef.current = draftContent;

  const hasDiff = draftContent !== originalContent;

  // Reset state when dialog opens
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setDraftContent(content);
        setOriginalContent(content);
        draftContentRef.current = content;
      }
      onOpenChange(nextOpen);
    },
    [content, onOpenChange]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/wiki-assist",
        body: () => ({
          currentContent: draftContentRef.current,
          documentName,
        }),
      }),
    [documentName]
  );

  const { messages, setMessages, sendMessage, status, addToolOutput } = useChat<WikiAssistMessage>({
    transport,
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "update_content") {
        const { content: newContent } = toolCall.input as WikiAssistTools["update_content"]["input"];
        setDraftContent(newContent);
        draftContentRef.current = newContent;
        addToolOutput({
          tool: "update_content",
          toolCallId: toolCall.toolCallId,
          output: "已更新",
        });
      } else if (toolCall.toolName === "edit_content") {
        const { old_text, new_text } = toolCall.input as WikiAssistTools["edit_content"]["input"];
        const current = draftContentRef.current;
        if (current.includes(old_text)) {
          const updated = current.replace(old_text, new_text);
          setDraftContent(updated);
          draftContentRef.current = updated;
        }
        addToolOutput({
          tool: "edit_content",
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
      setDraftContent(content);
      setOriginalContent(content);
      draftContentRef.current = content;
      setMessages([]);
      setInput("");
    }
    prevOpenRef.current = open;
  }, [open, content, setMessages]);

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
    onApply(draftContent);
    onOpenChange(false);
  }, [draftContent, onApply, onOpenChange]);

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
            <DialogTitle>AI 辅助编辑文档</DialogTitle>
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
                      {buildSystemPrompt(draftContent, documentName)}
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
                  original={originalContent}
                  value={draftContent}
                  readOnly={isStreaming}
                  onChange={setDraftContent}
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
                  描述你想要的修改，AI 会帮你更新左侧文档内容
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
                      placeholder="描述你想要的文档修改..."
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
