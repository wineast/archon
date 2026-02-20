"use client";

import { useCallback, useState } from "react";
import { CrownIcon, Trash2Icon } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import {
  useOrgMembers,
  inviteOrgMember,
  updateOrgMemberRole,
  removeOrgMember,
  transferOrgOwnership,
} from "@/lib/orgs/members-hooks";
import type { OrgMemberInfo } from "@/lib/orgs/members-hooks";
import { useOrgRole } from "@/lib/auth/hooks";

interface OrgMembersPanelProps {
  orgId: string;
}

export function OrgMembersPanel({ orgId }: OrgMembersPanelProps) {
  const { members, mutate } = useOrgMembers(orgId);
  const { canDelete: isOwner } = useOrgRole(orgId);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [busy, setBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "remove" | "transfer";
    member: OrgMemberInfo;
  } | null>(null);

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return;
    setBusy(true);
    const result = await inviteOrgMember(orgId, { email: inviteEmail.trim(), role: inviteRole }, mutate);
    if (result) {
      setInviteEmail("");
    }
    setBusy(false);
  }, [orgId, inviteEmail, inviteRole, mutate]);

  const handleRoleChange = useCallback(
    async (memberId: string, role: string) => {
      setBusy(true);
      await updateOrgMemberRole(orgId, memberId, role, mutate);
      setBusy(false);
    },
    [orgId, mutate]
  );

  const handleRemove = useCallback(async () => {
    if (!confirmDialog || confirmDialog.type !== "remove") return;
    await removeOrgMember(orgId, confirmDialog.member.id, mutate);
    setConfirmDialog(null);
  }, [orgId, confirmDialog, mutate]);

  const handleTransfer = useCallback(async () => {
    if (!confirmDialog || confirmDialog.type !== "transfer") return;
    await transferOrgOwnership(orgId, confirmDialog.member.userId, mutate);
    setConfirmDialog(null);
  }, [orgId, confirmDialog, mutate]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center px-4 py-3">
        <h2 className="text-sm font-medium">组织成员</h2>
      </div>

      {/* Invite section */}
      <div className="flex items-center gap-2 px-4 pb-3">
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
            <SelectItem value="member">Member</SelectItem>
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
                    <SelectItem value="member">Member</SelectItem>
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

              {isOwner && member.role !== "owner" && (
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
