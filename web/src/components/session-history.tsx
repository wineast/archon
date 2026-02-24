"use client";

import { useCallback, useRef, useState } from "react";
import {
  EllipsisVerticalIcon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
  UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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
  onDeleteSession: (sessionId: string) => Promise<void>;
  onRenameSession: (sessionId: string, title: string) => Promise<void>;
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
  onRenameSession,
  onNewChat,
  canViewAllSessions,
  showAll,
  onToggleShowAll,
}: SessionHistoryProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const deleteTargetRef = useRef<string | null>(null);
  const renameTargetRef = useRef<{ id: string; title: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

  const handleDeleteClick = useCallback((id: string) => {
    deleteTargetRef.current = id;
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteTargetRef.current) {
      await onDeleteSession(deleteTargetRef.current);
    }
  }, [onDeleteSession]);

  const handleRenameClick = useCallback((id: string, title: string) => {
    renameTargetRef.current = { id, title };
    setRenameValue(title);
    setRenameDialogOpen(true);
  }, []);

  const handleRenameConfirm = useCallback(async () => {
    if (!renameTargetRef.current || !renameValue.trim()) return;
    setRenameBusy(true);
    try {
      await onRenameSession(renameTargetRef.current.id, renameValue.trim());
      setRenameDialogOpen(false);
    } finally {
      setRenameBusy(false);
    }
  }, [onRenameSession, renameValue]);

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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction showOnHover>
                        <EllipsisVerticalIcon />
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuItem
                        onClick={() => handleRenameClick(session.id, session.title ?? "")}
                      >
                        <PencilIcon className="size-4" />
                        重命名
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => handleDeleteClick(session.id)}
                      >
                        <Trash2Icon className="size-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="删除会话"
        description="确定要删除这个会话吗？此操作无法撤销。"
        cancelLabel="取消"
        confirmLabel="删除"
        onConfirm={handleDeleteConfirm}
      />

      {/* Rename dialog */}
      <Dialog
        open={renameDialogOpen}
        onOpenChange={(v) => !renameBusy && setRenameDialogOpen(v)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名会话</DialogTitle>
            <DialogDescription>修改会话标题</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="输入新标题"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !renameBusy) {
                e.preventDefault();
                handleRenameConfirm();
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRenameDialogOpen(false)}
              disabled={renameBusy}
            >
              取消
            </Button>
            <Button
              onClick={handleRenameConfirm}
              disabled={renameBusy || !renameValue.trim()}
            >
              {renameBusy ? <Spinner className="mr-1 size-4" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
