"use client";

import { useCallback } from "react";
import { MessageSquareIcon, PlusIcon, Trash2Icon, UsersIcon, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { ChatSession } from "@/db/schema";

interface SessionHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewChat: () => void;
  canViewAllSessions?: boolean;
  showAll?: boolean;
  onToggleShowAll?: () => void;
}

export function SessionHistory({
  sessions,
  activeSessionId,
  onLoadSession,
  onDeleteSession,
  onNewChat,
  canViewAllSessions,
  showAll,
  onToggleShowAll,
}: SessionHistoryProps) {
  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onDeleteSession(id);
    },
    [onDeleteSession]
  );

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "今天";
    if (diffDays === 1) return "昨天";
    if (diffDays < 7) return `${diffDays} 天前`;
    return d.toLocaleDateString();
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onNewChat} tooltip="新对话">
              <PlusIcon />
              <span>新对话</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>{showAll ? "全部会话" : "我的会话"}</span>
            {canViewAllSessions && onToggleShowAll && (
              <Button
                variant="ghost"
                size="icon"
                className="size-5"
                onClick={onToggleShowAll}
                title={showAll ? "仅看我的" : "查看全部"}
              >
                {showAll ? <UsersIcon className="size-3" /> : <UserIcon className="size-3" />}
              </Button>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sessions.length === 0 && (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  暂无历史会话
                </p>
              )}
              {sessions.map((session) => (
                <SidebarMenuItem key={session.id}>
                  <SidebarMenuButton
                    isActive={activeSessionId === session.id}
                    onClick={() => onLoadSession(session.id)}
                    tooltip={session.title}
                  >
                    <MessageSquareIcon />
                    <span>{session.title}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    showOnHover
                    onClick={(e) => handleDelete(e, session.id)}
                    className="hover:text-destructive"
                  >
                    <Trash2Icon />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
