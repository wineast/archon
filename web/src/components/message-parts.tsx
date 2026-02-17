"use client";

import { isToolUIPart, isTextUIPart, isReasoningUIPart } from "ai";
import type { UIMessage } from "ai";
import {
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { getToolRenderer } from "@/tool-ui";

export function MessageParts({
  message,
  toolComponentMap,
}: {
  message: UIMessage;
  toolComponentMap: Record<string, string>;
}) {
  const sourceUrls = message.parts?.filter(
    (p) => p.type === "source-url"
  ) as Array<{ type: "source-url"; url: string; title?: string }>;

  return (
    <>
      {sourceUrls?.length > 0 && (
        <Sources>
          <SourcesTrigger count={sourceUrls.length} />
          <SourcesContent>
            {sourceUrls.map((source) => (
              <Source
                href={source.url}
                key={source.url}
                title={source.title ?? source.url}
              />
            ))}
          </SourcesContent>
        </Sources>
      )}
      {message.parts?.map((part, i) => {
        if (isReasoningUIPart(part)) {
          return (
            <Reasoning isStreaming={part.state === "streaming"} key={`reasoning-${i}`}>
              <ReasoningTrigger />
              <ReasoningContent>{part.text}</ReasoningContent>
            </Reasoning>
          );
        }
        if (isToolUIPart(part)) {
          const isDynamic = part.type === "dynamic-tool";
          const toolName = isDynamic
            ? (part as { toolName: string }).toolName
            : part.type.split("-").slice(1).join("-");
          const CustomRenderer = getToolRenderer(toolComponentMap[toolName]);

          // No custom renderer → only show in development
          if (!CustomRenderer && process.env.NODE_ENV !== "development") {
            return null;
          }

          if (CustomRenderer) {
            return (
              <CustomRenderer
                key={`tool-${i}`}
                toolName={toolName}
                state={part.state}
                input={part.input}
                output={part.output}
              />
            );
          }

          return (
            <Tool key={`tool-${i}`}>
              {isDynamic ? (
                <ToolHeader state={part.state} toolName={toolName} type="dynamic-tool" />
              ) : (
                <ToolHeader state={part.state} type={part.type as `tool-${string}`} />
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
