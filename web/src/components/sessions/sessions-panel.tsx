"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { isTextUIPart } from "ai";
import type { UIMessage } from "ai";
import { MessageSquareIcon, UsersIcon, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useSessions } from "@/lib/session/hooks";
import { useAgentRole } from "@/lib/auth/hooks";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatRelativeTime(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays} 天前`;
  return d.toLocaleDateString();
}

interface SessionsPanelProps {
  agentId: string;
}

export function SessionsPanel({ agentId }: SessionsPanelProps) {
  const { canViewAllSessions } = useAgentRole(agentId);
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { sessions, isLoading } = useSessions(agentId, showAll);

  const selected = useMemo(
    () => sessions.find((s) => s.id === selectedId) ?? null,
    [sessions, selectedId]
  );

  return (
    <div className="flex h-full">
      {/* Left: session list */}
      <div className="flex w-72 shrink-0 flex-col border-r">
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">会话记录</span>
            {!isLoading && (
              <Badge variant="secondary" className="text-xs">
                {sessions.length}
              </Badge>
            )}
          </div>
          {canViewAllSessions && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setShowAll((v) => !v)}
              title={showAll ? "仅看我的" : "查看全部"}
            >
              {showAll ? (
                <UsersIcon className="size-3.5" />
              ) : (
                <UserIcon className="size-3.5" />
              )}
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="min-h-0 flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="size-5" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              暂无会话记录
            </p>
          ) : (
            <div className="flex flex-col gap-0.5 p-2">
              {sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={selectedId === session.id}
                  onClick={() => setSelectedId(session.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: conversation viewer */}
      <div className="flex min-h-0 flex-1 flex-col">
        {selected ? (
          <SessionViewer session={selected} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <MessageSquareIcon className="size-8" />
              <p className="text-sm">选择一个会话查看详情</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Session list item ── */

function SessionItem({
  session,
  isActive,
  onClick,
}: {
  session: ChatSession;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent",
        isActive && "bg-accent"
      )}
    >
      <span className="truncate text-sm font-medium">{session.title}</span>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{session.messageCount} 条消息</span>
        <span>·</span>
        <span>{formatRelativeTime(session.createdAt)}</span>
      </div>
    </button>
  );
}

/* ── Session viewer (right pane) ── */

function SessionViewer({ session }: { session: ChatSession }) {
  const { data: rawMessages, isLoading } = useSWR<
    Array<{ id: string; role: "user" | "assistant" | "system"; parts: unknown[] }>
  >(`/api/sessions/${session.id}/messages`, fetcher);

  const uiMessages: UIMessage[] = useMemo(
    () =>
      (rawMessages ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts as UIMessage["parts"],
      })),
    [rawMessages]
  );

  return (
    <>
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <span className="truncate text-sm font-medium">{session.title}</span>
        <Badge variant="secondary" className="shrink-0 text-xs">
          {session.model}
        </Badge>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatRelativeTime(session.createdAt)}
        </span>
      </div>

      {/* Messages */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-5" />
        </div>
      ) : uiMessages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">该会话暂无消息</p>
        </div>
      ) : (
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
      )}
    </>
  );
}
