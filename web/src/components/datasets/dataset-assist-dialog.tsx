"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DefaultChatTransport, isTextUIPart, isToolUIPart, getToolName } from "ai";
import { useChat } from "@ai-sdk/react";
import type { UIMessage, UIDataTypes } from "ai";
import { CheckIcon, CopyIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { JsonEditor } from "@/components/editors/json-editor";
import { SlotAgentSelect } from "@/components/slots/slot-agent-select";

type DatasetAssistTools = {
  update_data: { input: { content: string }; output: string };
  edit_data: { input: { old_text: string; new_text: string }; output: string };
};

type DatasetAssistMessage = UIMessage<unknown, UIDataTypes, DatasetAssistTools>;

interface DatasetAssistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: string;
  datasetName?: string;
  datasetDescription?: string;
  templateVariables?: string[];
  agentId?: string;
  orgId?: string;
  onApply: (newData: string) => void;
}

function buildSystemPrompt(currentData: string, datasetName?: string, datasetDescription?: string): string {
  return `你是一位专业的数据编辑助手。你的任务是帮助用户编写和优化数据集内容。

当前编辑器中的数据如下：
<current_data>
${currentData}
</current_data>

${datasetName ? `## 数据集名称\n\n${datasetName}\n\n` : ""}${datasetDescription ? `## 数据集描述\n\n${datasetDescription}\n\n` : ""}## 数据格式

数据可以是有效的 JSON，也可以包含 LiquidJS 模板语法。

### 常见数据模式
- 简单值、对象、数组、嵌套条目对象

## 可用工具

### update_data — 整体替换
必须提供完整的数据字符串。

### edit_data — 局部编辑
old_text 必须精确匹配当前内容。

## 工作规则
1. 小范围修改优先使用 edit_data
2. 大范围重写使用 update_data
3. JSON 模式下确保输出是合法的 JSON
4. 模板模式下保持 LiquidJS 语法不变
5. 用中文回复`;
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
                update_data: "整体替换",
                edit_data: "局部编辑",
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

export function DatasetAssistDialog({
  open,
  onOpenChange,
  data,
  datasetName,
  datasetDescription,
  templateVariables,
  agentId,
  orgId,
  onApply,
}: DatasetAssistDialogProps) {
  const [draftData, setDraftData] = useState(data);
  const [originalData, setOriginalData] = useState(data);
  const [input, setInput] = useState("");
  const draftRef = useRef(draftData);
  draftRef.current = draftData;

  const hasDiff = draftData !== originalData;
  const sessionIdRef = useRef<string | null>(null);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setDraftData(data);
        setOriginalData(data);
        draftRef.current = data;
        sessionIdRef.current = null;
      }
      onOpenChange(nextOpen);
    },
    [data, onOpenChange]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/dataset-assist",
        body: () => {
          if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID();
          return {
            currentData: draftRef.current,
            datasetName,
            datasetDescription,
            agentId,
            sessionId: sessionIdRef.current,
          };
        },
      }),
    [datasetName, datasetDescription, agentId]
  );

  const { messages, setMessages, sendMessage, status, addToolOutput } = useChat<DatasetAssistMessage>({
    transport,
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "update_data") {
        const { content } = toolCall.input as DatasetAssistTools["update_data"]["input"];
        setDraftData(content);
        draftRef.current = content;
        addToolOutput({
          tool: "update_data",
          toolCallId: toolCall.toolCallId,
          output: "已更新",
        });
      } else if (toolCall.toolName === "edit_data") {
        const { old_text, new_text } = toolCall.input as DatasetAssistTools["edit_data"]["input"];
        const current = draftRef.current;
        if (current.includes(old_text)) {
          const updated = current.replace(old_text, new_text);
          setDraftData(updated);
          draftRef.current = updated;
        }
        addToolOutput({
          tool: "edit_data",
          toolCallId: toolCall.toolCallId,
          output: current.includes(old_text) ? "已更新" : "未找到匹配文本",
        });
      }
    },
  });

  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraftData(data);
      setOriginalData(data);
      draftRef.current = data;
      setMessages([]);
      setInput("");
    }
    prevOpenRef.current = open;
  }, [open, data, setMessages]);

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
    onApply(draftData);
    onOpenChange(false);
  }, [draftData, onApply, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const [copied, setCopied] = useState(false);
  const handleCopyMessages = useCallback(() => {
    navigator.clipboard.writeText(formatMessagesForCopy(messages));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [messages]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex h-[80vh] w-[90vw] max-w-[calc(100%-2rem)] sm:max-w-7xl flex-col p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <DialogTitle>AI 辅助编辑数据</DialogTitle>
            {agentId && orgId && (
              <SlotAgentSelect agentId={agentId} orgId={orgId} slotKey="assist" className="w-40" />
            )}
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 text-xs" onClick={handleCopyMessages}>
                {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
                {copied ? "已复制" : "复制对话"}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <div className="relative flex w-1/2 flex-col border-r">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
              Diff
            </div>
            <div className="flex-1 min-h-0">
              {open && (
                <JsonEditor
                  original={originalData}
                  value={draftData}
                  readOnly={isStreaming}
                  onChange={setDraftData}
                  className="h-full border-0"
                  templateVariables={templateVariables}
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
                  描述你想要的修改，AI 会帮你更新左侧数据
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
                      placeholder="描述你想要的数据修改..."
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
