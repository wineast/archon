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
  toolComponentMap: Record<string, string>;
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
        setSession(data);
      } catch {
        setError("load_failed");
      } finally {
        setIsLoading(false);
      }
    }
    fetchSession();
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
                <MessageParts message={message} toolComponentMap={session.toolComponentMap} />
              )}
            </Message>
          ))}
        </ConversationContent>
      </Conversation>
    </div>
  );
}
