"use client";

import { useCallback, useState } from "react";
import { CopyIcon, PlusIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type { InvitationCodeRow } from "@/db/schema";
import {
  useInvitationCodes,
  createInvitationCode,
  updateInvitationCode,
  deleteInvitationCode,
} from "@/lib/admin/invitation-code-hooks";

function formatDate(date: string | Date | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function StatusBadge({ code }: { code: InvitationCodeRow }) {
  if (!code.isActive) {
    return <Badge variant="secondary">已禁用</Badge>;
  }
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
    return <Badge variant="secondary">已过期</Badge>;
  }
  if (code.maxUses !== null && code.usedCount >= code.maxUses) {
    return <Badge variant="secondary">已用完</Badge>;
  }
  return <Badge>有效</Badge>;
}

function CreateDialog({
  open,
  onOpenChange,
  mutate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mutate: () => void;
}) {
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    const result = await createInvitationCode(
      {
        label: label || undefined,
        maxUses: maxUses ? parseInt(maxUses, 10) : null,
        expiresAt: expiresAt || null,
      },
      mutate
    );
    setSaving(false);
    if (result) {
      setLabel("");
      setMaxUses("");
      setExpiresAt("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建邀请码</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1">
            <Label className="text-xs font-medium text-muted-foreground">
              备注
            </Label>
            <Input
              placeholder="可选，如用途说明"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs font-medium text-muted-foreground">
              最大使用次数
            </Label>
            <Input
              type="number"
              min={1}
              placeholder="留空表示不限"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs font-medium text-muted-foreground">
              过期时间
            </Label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={saving}>
            {saving && <Spinner className="size-4" />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InvitationCodesSection() {
  const { codes, isLoading, mutate } = useInvitationCodes();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InvitationCodeRow | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const handleCopy = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("已复制邀请码");
  }, []);

  const handleToggleActive = useCallback(
    async (row: InvitationCodeRow) => {
      setBusy(true);
      await updateInvitationCode(
        row.id,
        { isActive: !row.isActive },
        mutate
      );
      setBusy(false);
    },
    [mutate]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteInvitationCode(deleteTarget.id, mutate);
  }, [deleteTarget, mutate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          邀请码管理 ({codes.length})
        </h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          创建
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        {codes.map((row) => (
          <div
            key={row.id}
            className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50"
          >
            <code className="shrink-0 font-mono text-sm font-medium tracking-wider">
              {row.code}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              onClick={() => handleCopy(row.code)}
              title="复制邀请码"
            >
              <CopyIcon className="size-3" />
            </Button>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {row.label || "-"}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {row.usedCount}/{row.maxUses ?? "∞"}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {row.expiresAt ? formatDate(row.expiresAt) : "永不过期"}
            </span>
            <StatusBadge code={row} />
            <Switch
              checked={row.isActive}
              onCheckedChange={() => handleToggleActive(row)}
              disabled={busy}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => setDeleteTarget(row)}
              title="删除"
            >
              <TrashIcon className="size-4" />
            </Button>
          </div>
        ))}
        {codes.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            暂无邀请码
          </p>
        )}
      </div>

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mutate={mutate}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="删除邀请码"
        description={`确定要删除邀请码 ${deleteTarget?.code ?? ""} 吗？此操作不可撤销。`}
        confirmLabel="删除"
        onConfirm={handleDelete}
      />
    </div>
  );
}
