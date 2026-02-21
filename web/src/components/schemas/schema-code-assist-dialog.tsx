"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DefaultChatTransport, isTextUIPart, isToolUIPart, getToolName } from "ai";
import { useChat } from "@ai-sdk/react";
import type { UIMessage, UIDataTypes } from "ai";
import { CheckIcon, CopyIcon, InfoIcon } from "lucide-react";
import { json } from "@codemirror/lang-json";
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
import { DiffEditor } from "@/components/editors/diff-editor";

type SchemaCodeAssistTools = {
  update_schema: { input: { content: string }; output: string };
  edit_schema: { input: { old_text: string; new_text: string }; output: string };
};

type SchemaCodeAssistMessage = UIMessage<unknown, UIDataTypes, SchemaCodeAssistTools>;

interface SchemaCodeAssistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: string;
  context?: string;
  onApply: (newSchema: string) => void;
  agentId?: string;
}

const jsonLanguage = json();

function buildSystemPrompt(currentSchema: string, context?: string): string {
  return `你是一位专业的 JSON Schema 7 专家。你的任务是帮助用户编写和优化 JSON Schema 定义。

当前编辑器中的 JSON Schema 如下：
<current_schema>
${currentSchema}
</current_schema>

${context ? `## Schema 上下文\n\n${context}\n\n` : ""}## JSON Schema 7 规范

Schema 定义使用标准 JSON Schema 7 格式。

### 基本结构
\`\`\`json
{
  "type": "object",
  "properties": {
    "field_name": { "type": "string", "description": "字段描述" }
  },
  "required": ["field_name"]
}
\`\`\`

### 支持的类型
- string, integer, number, boolean, object, array, null

### 组合与引用
- \`$ref\`: "#/$defs/schema_key"
- allOf / oneOf / anyOf

## 可用工具

### update_schema — 整体替换
必须提供完整的 JSON Schema JSON 字符串。

### edit_schema — 局部编辑
old_text 必须精确匹配当前内容。

## 工作规则
1. 小范围修改优先使用 edit_schema
2. 大范围重写使用 update_schema
3. 输出必须是合法的 JSON Schema 7
4. 属性名使用 snake_case，每个属性应有 description
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
                update_schema: "整体替换",
                edit_schema: "局部编辑",
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

export function SchemaCodeAssistDialog({
  open,
  onOpenChange,
  schema,
  context,
  agentId,
  onApply,
}: SchemaCodeAssistDialogProps) {
  const [draftSchema, setDraftSchema] = useState(schema);
  const [originalSchema, setOriginalSchema] = useState(schema);
  const [input, setInput] = useState("");
  const draftSchemaRef = useRef(draftSchema);
  draftSchemaRef.current = draftSchema;

  const hasDiff = draftSchema !== originalSchema;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setDraftSchema(schema);
        setOriginalSchema(schema);
        draftSchemaRef.current = schema;
      }
      onOpenChange(nextOpen);
    },
    [schema, onOpenChange]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/schema-code-assist",
        body: () => ({
          currentSchema: draftSchemaRef.current,
          context,
          agentId,
        }),
      }),
    [context, agentId]
  );

  const { messages, setMessages, sendMessage, status, addToolOutput } = useChat<SchemaCodeAssistMessage>({
    transport,
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "update_schema") {
        const { content } = toolCall.input as SchemaCodeAssistTools["update_schema"]["input"];
        setDraftSchema(content);
        draftSchemaRef.current = content;
        addToolOutput({
          tool: "update_schema",
          toolCallId: toolCall.toolCallId,
          output: "已更新",
        });
      } else if (toolCall.toolName === "edit_schema") {
        const { old_text, new_text } = toolCall.input as SchemaCodeAssistTools["edit_schema"]["input"];
        const current = draftSchemaRef.current;
        if (current.includes(old_text)) {
          const updated = current.replace(old_text, new_text);
          setDraftSchema(updated);
          draftSchemaRef.current = updated;
        }
        addToolOutput({
          tool: "edit_schema",
          toolCallId: toolCall.toolCallId,
          output: current.includes(old_text) ? "已更新" : "未找到匹配文本",
        });
      }
    },
  });

  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraftSchema(schema);
      setOriginalSchema(schema);
      draftSchemaRef.current = schema;
      setMessages([]);
      setInput("");
    }
    prevOpenRef.current = open;
  }, [open, schema, setMessages]);

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
    onApply(draftSchema);
    onOpenChange(false);
  }, [draftSchema, onApply, onOpenChange]);

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
            <DialogTitle>AI 辅助编辑 Schema</DialogTitle>
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
                      {buildSystemPrompt(draftSchema, context)}
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
                <DiffEditor
                  original={originalSchema}
                  modified={draftSchema}
                  readOnly={isStreaming}
                  onModifiedChange={setDraftSchema}
                  language={jsonLanguage}
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
                  描述你想要的 Schema 结构，AI 会帮你编写左侧 JSON Schema
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
                      placeholder="描述你想要的 Schema 结构..."
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
