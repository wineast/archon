"use client";

import { useCallback, useRef, useState } from "react";
import { RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { ComponentForm, type ComponentFormHandle } from "./component-form";
import type { ComponentRow } from "@/db/schema";
import type { ComponentDefinition } from "@/lib/components/types";

interface ComponentDetailProps {
  component: ComponentRow;
  onSave: (updated: ComponentDefinition) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ComponentDetail({ component, onSave, onDelete }: ComponentDetailProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const draftRef = useRef<ComponentFormHandle | null>(null);
  const handleDraftRef = useCallback((ref: ComponentFormHandle) => {
    draftRef.current = ref;
  }, []);
  const [dirty, setDirty] = useState(false);
  const busy = saving || deleting;

  const handleSave = useCallback(async () => {
    if (!draftRef.current) return;
    const draft = draftRef.current.getDraft();
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(component.id);
    } finally {
      setDeleting(false);
    }
  }, [component.id, onDelete]);

  return (
    <div className="flex h-full flex-col">
      {/* Form body */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 min-w-0 overflow-hidden">
          <ComponentForm
            component={{
              id: component.id,
              key: component.key,
              name: component.name,
              description: component.description,
              componentSource: component.componentSource,
              componentMockData: component.componentMockData,
            }}
            onDraftRef={handleDraftRef}
            onDirtyChange={setDirty}
          />
        </div>
      </ScrollArea>

      {/* Bottom bar */}
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
          variant="ghost"
          size="sm"
          onClick={() => draftRef.current?.reset()}
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
