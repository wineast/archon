"use client";

import { useCallback, useState } from "react";
import { RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  DataObjectForm,
  type DataObjectFormHandle,
} from "./data-object-form";
import type { DataObjectRow } from "@/db/schema";

interface DataObjectDetailProps {
  object: DataObjectRow;
  onSave: (
    id: string,
    data: { name: string; description: string; data: Record<string, unknown> }
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function DataObjectDetail({
  object,
  onSave,
  onDelete,
}: DataObjectDetailProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draftRef, setDraftRef] = useState<DataObjectFormHandle | null>(null);
  const [dirty, setDirty] = useState(false);
  const busy = saving || deleting;

  const handleSave = useCallback(async () => {
    if (!draftRef) return;
    const draft = draftRef.getDraft();
    setSaving(true);
    try {
      await onSave(object.id, {
        name: draft.name,
        description: draft.description,
        data: draft.data,
      });
    } finally {
      setSaving(false);
    }
  }, [draftRef, onSave, object.id]);

  const handleReset = useCallback(() => {
    draftRef?.reset();
  }, [draftRef]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(object.id);
    } finally {
      setDeleting(false);
    }
  }, [object.id, onDelete]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="p-4">
          <DataObjectForm
            key={object.id}
            objectKey={object.key}
            name={object.name}
            description={object.description}
            data={(object.data as Record<string, unknown>) ?? {}}
            agentId={object.agentId}
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
