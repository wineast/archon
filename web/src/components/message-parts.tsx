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
import {
  getCompiledToolComponent,
  getDynamicToolSource,
  DynamicToolRenderer,
  DynamicComponentErrorBoundary,
} from "@/tool-ui";

export function MessageParts({
  message,
}: {
  message: UIMessage;
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

          // 1a) Pre-compiled component (with composition support)
          const compiledComp = getCompiledToolComponent(toolName);
          if (compiledComp) {
            return (
              <DynamicComponentErrorBoundary key={`tool-${i}`} fallbackToolName={toolName}>
                <DynamicToolRenderer
                  tool={{ name: toolName, input: part.input, output: part.output }}
                  state={part.state}
                  compiledComponent={compiledComp}
                />
              </DynamicComponentErrorBoundary>
            );
          }

          // 1b) Dynamic component source from DB (no composition)
          const dynamicSource = getDynamicToolSource(toolName);
          if (dynamicSource) {
            return (
              <DynamicComponentErrorBoundary key={`tool-${i}`} fallbackToolName={toolName}>
                <DynamicToolRenderer
                  tool={{ name: toolName, input: part.input, output: part.output }}
                  state={part.state}
                  source={dynamicSource}
                />
              </DynamicComponentErrorBoundary>
            );
          }

          // 2) Default tool UI (only in dev mode)
          if (process.env.NODE_ENV !== "development") {
            return null;
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
