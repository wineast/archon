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
            <SidebarMenuButton onClick={onNewChat} tooltip="New chat">
              <PlusIcon />
              <span>New chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>{showAll ? "All sessions" : "My sessions"}</span>
            {canViewAllSessions && onToggleShowAll && (
              <Button
                variant="ghost"
                size="icon"
                className="size-5"
                onClick={onToggleShowAll}
                title={showAll ? "Show only mine" : "Show all"}
              >
                {showAll ? (
                  <UsersIcon className="size-3" />
                ) : (
                  <UserIcon className="size-3" />
                )}
              </Button>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sessions.length === 0 && (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  No chat history yet
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
                        onClick={() =>
                          handleRenameClick(session.id, session.title ?? "")
                        }
                      >
                        <PencilIcon className="size-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => handleDeleteClick(session.id)}
                      >
                        <Trash2Icon className="size-4" />
                        Delete
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
        title="Delete conversation"
        description="Delete this conversation? This cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
      />

      {/* Rename dialog */}
      <Dialog
        open={renameDialogOpen}
        onOpenChange={(v) => !renameBusy && setRenameDialogOpen(v)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
            <DialogDescription>Change the conversation title</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="New title"
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
              Cancel
            </Button>
            <Button
              onClick={handleRenameConfirm}
              disabled={renameBusy || !renameValue.trim()}
            >
              {renameBusy ? <Spinner className="mr-1 size-4" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
