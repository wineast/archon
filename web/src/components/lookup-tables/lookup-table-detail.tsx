"use client";

import { useCallback, useState } from "react";
import { RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  LookupTableForm,
  type LookupTableFormHandle,
} from "./lookup-table-form";
import type { LookupTableWithEntries } from "@/lib/lookup-tables/hooks";

interface LookupTableDetailProps {
  table: LookupTableWithEntries;
  onSave: (
    id: string,
    data: { name: string; description: string },
    entries: Array<{
      value: string;
      label?: string;
      metadata?: Record<string, unknown> | null;
    }>
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function LookupTableDetail({
  table,
  onSave,
  onDelete,
}: LookupTableDetailProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draftRef, setDraftRef] = useState<LookupTableFormHandle | null>(null);
  const [dirty, setDirty] = useState(false);
  const busy = saving || deleting;

  const handleSave = useCallback(async () => {
    if (!draftRef) return;
    const draft = draftRef.getDraft();
    setSaving(true);
    try {
      await onSave(
        table.id,
        { name: draft.name, description: draft.description },
        draft.entries.map((e) => ({
          value: e.value,
          label: e.label || undefined,
          metadata: e.metadata,
        }))
      );
    } finally {
      setSaving(false);
    }
  }, [draftRef, onSave, table.id]);

  const handleReset = useCallback(() => {
    draftRef?.reset();
  }, [draftRef]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(table.id);
    } finally {
      setDeleting(false);
    }
  }, [table.id, onDelete]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="p-4">
          <LookupTableForm
            key={table.id}
            tableKey={table.key}
            name={table.name}
            description={table.description}
            entries={table.entries}
            onDraftRef={setDraftRef}
            onDirtyChange={setDirty}
          />
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 border-t px-4 py-2">
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
          variant="outline"
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
          onClick={handleDelete}
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
    </div>
  );
}
