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

type ToolCodeAssistTools = {
  update_code: { input: { content: string }; output: string };
  edit_code: { input: { old_text: string; new_text: string }; output: string };
};

type ToolCodeAssistMessage = UIMessage<unknown, UIDataTypes, ToolCodeAssistTools>;

interface ToolCodeAssistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  toolName?: string;
  toolDescription?: string;
  onApply: (newCode: string) => void;
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
                update_code: "整体替换",
                edit_code: "局部编辑",
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

export function ToolCodeAssistDialog({
  open,
  onOpenChange,
  code,
  toolName,
  toolDescription,
  onApply,
}: ToolCodeAssistDialogProps) {
  const [draftCode, setDraftCode] = useState(code);
  const [originalCode, setOriginalCode] = useState(code);
  const [input, setInput] = useState("");
  const draftCodeRef = useRef(draftCode);
  draftCodeRef.current = draftCode;

  const hasDiff = draftCode !== originalCode;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setDraftCode(code);
        setOriginalCode(code);
        draftCodeRef.current = code;
      }
      onOpenChange(nextOpen);
    },
    [code, onOpenChange]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/tool-code-assist",
        body: () => ({
          currentCode: draftCodeRef.current,
          toolName,
          toolDescription,
        }),
      }),
    [toolName, toolDescription]
  );

  const { messages, setMessages, sendMessage, status, addToolOutput } = useChat<ToolCodeAssistMessage>({
    transport,
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "update_code") {
        const { content } = toolCall.input as ToolCodeAssistTools["update_code"]["input"];
        setDraftCode(content);
        draftCodeRef.current = content;
        addToolOutput({
          tool: "update_code",
          toolCallId: toolCall.toolCallId,
          output: "已更新",
        });
      } else if (toolCall.toolName === "edit_code") {
        const { old_text, new_text } = toolCall.input as ToolCodeAssistTools["edit_code"]["input"];
        const current = draftCodeRef.current;
        if (current.includes(old_text)) {
          const updated = current.replace(old_text, new_text);
          setDraftCode(updated);
          draftCodeRef.current = updated;
        }
        addToolOutput({
          tool: "edit_code",
          toolCallId: toolCall.toolCallId,
          output: current.includes(old_text) ? "已更新" : "未找到匹配文本",
        });
      }
    },
  });

  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraftCode(code);
      setOriginalCode(code);
      draftCodeRef.current = code;
      setMessages([]);
      setInput("");
    }
    prevOpenRef.current = open;
  }, [open, code, setMessages]);

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
    onApply(draftCode);
    onOpenChange(false);
  }, [draftCode, onApply, onOpenChange]);

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

  const sysPromptPreview = useMemo(() => {
    const toolContext = [
      toolName && `工具名称：${toolName}`,
      toolDescription && `工具描述：${toolDescription}`,
    ]
      .filter(Boolean)
      .join("\n");

    return `你是一位专业的工具 Handler 开发工程师。你的任务是帮助用户编写和优化工具的 Handler 代码。

当前编辑器中的 Handler 代码如下：
<current_code>
${draftCode}
</current_code>

${toolContext ? `## 工具信息\n\n${toolContext}\n\n` : ""}## Handler 架构

Handler 是一个异步函数，签名为 \`async (args, context) => result\`

## Context API: context.wiki / context.dataset / context.fn / context.ontology

（完整内容见 API 路由）`;
  }, [draftCode, toolName, toolDescription]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex h-[80vh] w-[90vw] max-w-[calc(100%-2rem)] sm:max-w-7xl flex-col p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <DialogTitle>AI 辅助编辑 Handler</DialogTitle>
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
                      {sysPromptPreview}
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
                  original={originalCode}
                  value={draftCode}
                  readOnly={isStreaming}
                  onChange={setDraftCode}
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
                  描述你想要的 Handler 逻辑，AI 会帮你编写左侧代码
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
                      placeholder="描述你想要的 Handler 逻辑..."
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
