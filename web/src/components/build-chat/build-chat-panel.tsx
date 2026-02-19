"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { DefaultChatTransport, isTextUIPart, isToolUIPart } from "ai";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useSWRConfig } from "swr";
import { BotIcon } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
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
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";

interface BuildChatPanelProps {
  agentId: string;
}

const SUGGESTIONS = [
  "列出所有工具",
  "创建一个新的工具",
  "查看当前模型配置",
  "修改聊天欢迎文案",
];

function BuildMessageParts({ message }: { message: UIMessage }) {
  return (
    <>
      {message.parts?.map((part, i) => {
        if (isToolUIPart(part)) {
          const isDynamic = part.type === "dynamic-tool";
          const toolName = isDynamic
            ? (part as { toolName: string }).toolName
            : part.type.split("-").slice(1).join("-");
          return (
            <Tool key={`tool-${i}`}>
              {isDynamic ? (
                <ToolHeader
                  state={part.state}
                  toolName={toolName}
                  type="dynamic-tool"
                />
              ) : (
                <ToolHeader
                  state={part.state}
                  type={part.type as `tool-${string}`}
                />
              )}
              <ToolContent>
                <ToolInput input={part.input} />
                <ToolOutput errorText={part.errorText} output={part.output} />
              </ToolContent>
            </Tool>
          );
        }
        if (isTextUIPart(part)) {
          return (
            <MessageContent key={`text-${i}`}>
              <MessageResponse>{part.text}</MessageResponse>
            </MessageContent>
          );
        }
        return null;
      })}
    </>
  );
}

export function BuildChatPanel({ agentId }: BuildChatPanelProps) {
  const { mutate: globalMutate } = useSWRConfig();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/build-chat",
        body: () => ({ agentId }),
      }),
    [agentId]
  );

  const { messages, sendMessage, status } = useChat({ transport });

  // Revalidate all agent resource SWR caches when streaming completes.
  // Server-side tool results arrive via the stream, not onToolCall.
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if ((prev === "streaming" || prev === "submitted") && status === "ready") {
      globalMutate(
        (key) => typeof key === "string" && key.includes(`agentId=${agentId}`),
        undefined,
        { revalidate: true }
      );
    }
  }, [status, globalMutate, agentId]);

  const handleSendMessage = useCallback(
    (msg: { text: string; files: unknown[] }) => {
      if (!msg.text.trim()) return;
      sendMessage({ text: msg.text, files: [] });
    },
    [sendMessage]
  );

  const handleSuggestion = useCallback(
    (suggestion: string) => {
      sendMessage({ text: suggestion, files: [] });
    },
    [sendMessage]
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full w-96 shrink-0 flex-col border-r">
      <Conversation>
        {isEmpty ? (
          <ConversationEmptyState
            title="Agent 配置助手"
            description="通过对话操作工具、Schema、Wiki、数据集等所有资源"
            icon={<BotIcon className="size-8" />}
          >
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="text-muted-foreground">
                <BotIcon className="size-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-medium text-sm">Agent 配置助手</h3>
                <p className="text-muted-foreground text-sm">
                  通过对话操作工具、Schema、Wiki 等所有资源
                </p>
              </div>
              <Suggestions className="mt-4 justify-center">
                {SUGGESTIONS.map((s) => (
                  <Suggestion
                    key={s}
                    suggestion={s}
                    onClick={handleSuggestion}
                  />
                ))}
              </Suggestions>
            </div>
          </ConversationEmptyState>
        ) : (
          <ConversationContent className="gap-4 p-3">
            {messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <BuildMessageParts message={message} />
              </Message>
            ))}
          </ConversationContent>
        )}
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t p-3">
        <PromptInput onSubmit={handleSendMessage}>
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="输入指令..."
              className="min-h-10"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <div />
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
