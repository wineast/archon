"use client";

import { useCallback, useState } from "react";
import { CheckIcon, PowerIcon, RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { SkillForm, type SkillFormHandle } from "./skill-form";
import type { SkillRow } from "@/db/schema";

interface SkillDetailProps {
  skill: SkillRow;
  agentId: string;
  onSave: (
    id: string,
    data: { name: string; description: string; content: string; enabled: boolean; order: number }
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
}

export function SkillDetail({
  skill,
  agentId,
  onSave,
  onDelete,
  onToggle,
}: SkillDetailProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [draftRef, setDraftRef] = useState<SkillFormHandle | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = saving || deleting || toggling;

  const handleSave = useCallback(async () => {
    if (!draftRef) return;
    const draft = draftRef.getDraft();
    setSaving(true);
    try {
      await onSave(skill.id, {
        name: draft.name,
        description: draft.description,
        content: draft.content,
        enabled: draft.enabled,
        order: draft.order,
      });
    } finally {
      setSaving(false);
    }
  }, [draftRef, onSave, skill.id]);

  const handleReset = useCallback(() => {
    draftRef?.reset();
  }, [draftRef]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(skill.id);
    } finally {
      setDeleting(false);
    }
  }, [skill.id, onDelete]);

  const handleToggle = useCallback(
    async (enabled: boolean) => {
      setToggling(true);
      try {
        await onToggle(skill.id, enabled);
      } finally {
        setToggling(false);
      }
    },
    [skill.id, onToggle]
  );

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0 overflow-hidden [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-4">
          <SkillForm
            key={skill.id}
            skillKey={skill.key}
            name={skill.name}
            description={skill.description}
            content={skill.content}
            enabled={skill.enabled}
            order={skill.order}
            agentId={agentId}
            onDraftRef={setDraftRef}
            onDirtyChange={setDirty}
          />
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button
          variant={skill.enabled ? "outline" : "ghost"}
          size="sm"
          onClick={() => handleToggle(!skill.enabled)}
          disabled={busy}
        >
          {toggling ? (
            <Spinner className="mr-1 size-3" />
          ) : skill.enabled ? (
            <CheckIcon className="mr-1 size-3" />
          ) : (
            <PowerIcon className="mr-1 size-3" />
          )}
          {skill.enabled ? "Enabled" : "Disabled"}
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={busy || !dirty}
        >
          {saving ? (
            <Spinner className="mr-1 size-3" />
          ) : (
            <SaveIcon className="mr-1 size-3" />
          )}
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={busy || !dirty}
        >
          <RotateCcwIcon className="mr-1 size-3" />
          Reset
        </Button>
        <div className="flex-1" />
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
        >
          {deleting ? (
            <Spinner className="mr-1 size-3" />
          ) : (
            <Trash2Icon className="mr-1 size-3" />
          )}
          {deleting ? "Deleting..." : "Delete"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Skill"
        description={`Are you sure you want to delete "${skill.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
