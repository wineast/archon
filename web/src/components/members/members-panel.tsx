"use client";

import { useCallback, useState } from "react";
import { CrownIcon, ShieldIcon, Trash2Icon, UserIcon } from "lucide-react";
import { GuideDialog } from "@/components/ui/guide-dialog";
import membersGuide from "../../../guide/user-permissions.md";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import {
  useMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  transferOwnership,
} from "@/lib/members/hooks";
import type { MemberInfo } from "@/lib/members/hooks";
import { useAgentRole } from "@/lib/auth/hooks";
import { toast } from "sonner";

interface MembersPanelProps {
  agentId: string;
  isPublic: boolean;
  onTogglePublic?: (isPublic: boolean) => void;
}

export function MembersPanel({
  agentId,
  isPublic,
  onTogglePublic,
}: MembersPanelProps) {
  const { members, mutate } = useMembers(agentId);
  const { canTransferOwner } = useAgentRole(agentId);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [busy, setBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "remove" | "transfer";
    member: MemberInfo;
  } | null>(null);

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return;
    setBusy(true);
    const result = await inviteMember(agentId, { email: inviteEmail.trim(), role: inviteRole }, mutate);
    if (result) {
      setInviteEmail("");
    }
    setBusy(false);
  }, [agentId, inviteEmail, inviteRole, mutate]);

  const handleRoleChange = useCallback(
    async (memberId: string, role: string) => {
      setBusy(true);
      await updateMemberRole(agentId, memberId, role, mutate);
      setBusy(false);
    },
    [agentId, mutate]
  );

  const handleRemove = useCallback(async () => {
    if (!confirmDialog || confirmDialog.type !== "remove") return;
    await removeMember(agentId, confirmDialog.member.id, mutate);
    setConfirmDialog(null);
  }, [agentId, confirmDialog, mutate]);

  const handleTransfer = useCallback(async () => {
    if (!confirmDialog || confirmDialog.type !== "transfer") return;
    await transferOwnership(agentId, confirmDialog.member.userId, mutate);
    setConfirmDialog(null);
  }, [agentId, confirmDialog, mutate]);

  const handleTogglePublic = useCallback(
    async (checked: boolean) => {
      if (!onTogglePublic) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/agents/${agentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublic: checked }),
        });
        if (!res.ok) throw new Error("Failed");
        onTogglePublic(checked);
      } catch {
        toast.error("修改访问模式失败");
      }
      setBusy(false);
    },
    [agentId, onTogglePublic]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="text-sm font-semibold">Members</span>
        <GuideDialog title="成员管理" content={membersGuide} />
        <div className="flex-1" />
      </div>

      {/* Invite section */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Input
          className="flex-1"
          placeholder="输入邮箱邀请..."
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleInvite();
          }}
        />
        <Select value={inviteRole} onValueChange={setInviteRole} disabled={busy}>
          <SelectTrigger className="w-24 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewer">Viewer</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" disabled={busy || !inviteEmail.trim()} onClick={handleInvite}>
          {busy ? <Spinner className="size-4" /> : "邀请"}
        </Button>
      </div>

      {/* Members list */}
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="flex flex-col gap-1 px-4 pb-4">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50"
            >
              <Avatar className="size-8">
                <AvatarImage src={member.avatarUrl ?? undefined} />
                <AvatarFallback>
                  {(member.nickname ?? member.email)?.[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.nickname || member.email}
                </p>
                {member.nickname && (
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email}
                  </p>
                )}
              </div>

              {member.role === "owner" ? (
                <Badge variant="outline" className="shrink-0">
                  <CrownIcon className="mr-1 size-3" />
                  Owner
                </Badge>
              ) : (
                <Select
                  value={member.role}
                  onValueChange={(role) => handleRoleChange(member.id, role)}
                  disabled={busy}
                >
                  <SelectTrigger className="h-7 w-24 shrink-0 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {member.role !== "owner" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={busy}
                  onClick={() => setConfirmDialog({ type: "remove", member })}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              )}

              {canTransferOwner && member.role !== "owner" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={busy}
                  onClick={() => setConfirmDialog({ type: "transfer", member })}
                  title="转让 Owner"
                >
                  <CrownIcon className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Access mode */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {isPublic ? (
            <UserIcon className="size-4 text-muted-foreground" />
          ) : (
            <ShieldIcon className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm">
            {isPublic ? "公开访问" : "仅成员可访问"}
          </span>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={handleTogglePublic}
          disabled={busy}
        />
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmDialog !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null);
        }}
        title={confirmDialog?.type === "transfer" ? "转让所有权" : "移除成员"}
        description={
          confirmDialog?.type === "transfer"
            ? `确定将 Owner 转让给 ${confirmDialog.member.nickname || confirmDialog.member.email}？你将变为 Admin。`
            : `确定移除 ${confirmDialog?.member.nickname || confirmDialog?.member.email}？`
        }
        cancelLabel="取消"
        confirmLabel="确定"
        confirmVariant={confirmDialog?.type === "transfer" ? "default" : "destructive"}
        onConfirm={confirmDialog?.type === "transfer" ? handleTransfer : handleRemove}
      />
    </div>
  );
}
