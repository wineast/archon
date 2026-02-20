"use client";

import { useCallback, useState } from "react";
import { RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  DatasetForm,
  type DatasetFormHandle,
} from "./dataset-form";
import type { DatasetRow } from "@/db/schema";

interface DatasetDetailProps {
  dataset: DatasetRow;
  onSave: (
    id: string,
    data: { name: string; description: string; data: unknown }
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function DatasetDetail({
  dataset,
  onSave,
  onDelete,
}: DatasetDetailProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draftRef, setDraftRef] = useState<DatasetFormHandle | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = saving || deleting;

  const handleSave = useCallback(async () => {
    if (!draftRef) return;
    const draft = draftRef.getDraft();
    setSaving(true);
    try {
      await onSave(dataset.id, {
        name: draft.name,
        description: draft.description,
        data: draft.data,
      });
    } finally {
      setSaving(false);
    }
  }, [draftRef, onSave, dataset.id]);

  const handleReset = useCallback(() => {
    draftRef?.reset();
  }, [draftRef]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(dataset.id);
    } finally {
      setDeleting(false);
    }
  }, [dataset.id, onDelete]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="p-4">
          <DatasetForm
            key={dataset.id}
            datasetKey={dataset.key}
            name={dataset.name}
            description={dataset.description}
            data={dataset.data}
            agentId={dataset.agentId}
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
        title="Delete Dataset"
        description={`Are you sure you want to delete "${dataset.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
