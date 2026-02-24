"use client";

import { use, useEffect, useState } from "react";
import { isTextUIPart } from "ai";
import type { UIMessage } from "ai";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { MessageParts } from "@/components/message-parts";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import {
  registerDynamicComponentSource,
  registerCompiledComponent,
  clearCompiledRegistry,
  compileComponentGraph,
  type ComponentRecord,
} from "@/tool-ui";

interface SharedSession {
  id: string;
  title: string;
  sharedAt: string;
  agentSlug: string | null;
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    parts: unknown[];
  }>;
  toolComponentSourceMap?: Record<string, string>;
  dynamicComponentCss?: string[];
  componentRecords?: ComponentRecord[];
}

export default function SharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = use(params);
  const [session, setSession] = useState<SharedSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/share/${shareId}`);
        if (!res.ok) {
          setError(res.status === 404 ? "not_found" : "load_failed");
          return;
        }
        const data = await res.json();
        // Compile component graph for composition support
        clearCompiledRegistry();
        if (data.componentRecords?.length) {
          try {
            const compiled = compileComponentGraph(data.componentRecords);
            // Register compiled components for tools that reference them
            if (data.toolComponentSourceMap) {
              for (const [toolName] of Object.entries(data.toolComponentSourceMap)) {
                // Check if this tool's source matches a compiled component
                for (const [key, comp] of compiled) {
                  const rec = data.componentRecords.find((r: ComponentRecord) => r.key === key);
                  if (rec && data.toolComponentSourceMap[toolName] === rec.source) {
                    registerCompiledComponent(toolName, comp);
                  }
                }
              }
            }
          } catch (e) {
            console.error("[component-composition]", e);
          }
        }
        // Register remaining dynamic component sources (fallback)
        if (data.toolComponentSourceMap) {
          for (const [name, source] of Object.entries(data.toolComponentSourceMap)) {
            registerDynamicComponentSource(name, source as string);
          }
        }
        // Inject dynamic component CSS wrapped in @layer components — lower
        // priority than global @layer utilities to avoid cascade conflicts.
        if (data.dynamicComponentCss?.length) {
          const style = document.createElement("style");
          style.setAttribute("data-dynamic-components", "true");
          style.textContent = `@layer components {\n${data.dynamicComponentCss.join("\n")}\n}`;
          document.head.appendChild(style);
        }
        setSession(data);
      } catch {
        setError("load_failed");
      } finally {
        setIsLoading(false);
      }
    }
    fetchSession();
    return () => {
      document.head
        .querySelectorAll("style[data-dynamic-components]")
        .forEach((el) => el.remove());
    };
  }, [shareId]);

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">
          {error === "not_found"
            ? "该分享链接不存在或已失效"
            : "加载失败，请稍后重试"}
        </p>
        <Button variant="outline" asChild>
          <a href="/">返回首页</a>
        </Button>
      </div>
    );
  }

  const uiMessages: UIMessage[] = session.messages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: m.parts as UIMessage["parts"],
  }));

  const backHref = session.agentSlug ? `/${session.agentSlug}` : "/";

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <Button variant="ghost" size="icon" className="size-8" asChild>
          <a href={backHref}>
            <ArrowLeftIcon className="size-4" />
          </a>
        </Button>
        <span className="text-sm font-medium">{session.title}</span>
        <Badge variant="secondary" className="ml-2 text-xs">
          分享预览
        </Badge>
      </header>
      <Conversation>
        <ConversationContent>
          {uiMessages.map((message) => (
            <Message from={message.role} key={message.id}>
              {message.role === "user" ? (
                <MessageContent>
                  <MessageResponse>
                    {message.parts
                      ?.filter(isTextUIPart)
                      .map((p) => p.text)
                      .join("")}
                  </MessageResponse>
                </MessageContent>
              ) : (
                <MessageParts message={message} />
              )}
            </Message>
          ))}
        </ConversationContent>
      </Conversation>
    </div>
  );
}
