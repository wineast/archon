"use client";

import { useCallback, useRef, useState } from "react";
import { RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  ObjectTypeForm,
  type ObjectTypeFormHandle,
  type ObjectTypeFormValues,
} from "./object-type-form";
import { RelationList } from "./relation-list";
import { RelationCreateDialog } from "./relation-create-dialog";
import type { ObjectTypeRow, ObjectRelationRow } from "@/db/schema";

interface ObjectTypeDetailProps {
  agentId: string;
  objectType: ObjectTypeRow;
  allObjectTypes: ObjectTypeRow[];
  relations: ObjectRelationRow[];
  onSave: (id: string, data: Omit<ObjectTypeFormValues, "key">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreateRelation: (data: {
    key: string;
    name: string;
    sourceTypeId: string;
    targetTypeId: string;
    relationType: string;
    inverseName: string;
  }) => Promise<void>;
  onDeleteRelation: (id: string) => Promise<void>;
}

export function ObjectTypeDetail({
  agentId,
  objectType,
  allObjectTypes,
  relations,
  onSave,
  onDelete,
  onCreateRelation,
  onDeleteRelation,
}: ObjectTypeDetailProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const draftRef = useRef<ObjectTypeFormHandle | null>(null);
  const handleDraftRef = useCallback((ref: ObjectTypeFormHandle) => {
    draftRef.current = ref;
  }, []);
  const [dirty, setDirty] = useState(false);
  const [relationDialogOpen, setRelationDialogOpen] = useState(false);
  const busy = saving || deleting;

  const handleSave = useCallback(async () => {
    if (!draftRef.current) return;
    const draft = draftRef.current.getDraft();
    setSaving(true);
    try {
      await onSave(objectType.id, {
        name: draft.name,
        description: draft.description,
        icon: draft.icon,
        color: draft.color,
        schemaId: draft.schemaId,
      });
    } finally {
      setSaving(false);
    }
  }, [objectType.id, onSave]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(objectType.id);
    } finally {
      setDeleting(false);
    }
  }, [objectType.id, onDelete]);

  const handleCreateRelation = useCallback(
    async (data: {
      key: string;
      name: string;
      targetTypeId: string;
      relationType: string;
      inverseName: string;
    }) => {
      await onCreateRelation({
        ...data,
        sourceTypeId: objectType.id,
      });
      setRelationDialogOpen(false);
    },
    [objectType.id, onCreateRelation]
  );

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-6 p-4 min-w-0 overflow-hidden">
          <ObjectTypeForm
            agentId={agentId}
            values={{
              key: objectType.key,
              name: objectType.name,
              description: objectType.description,
              icon: objectType.icon,
              color: objectType.color,
              schemaId: objectType.schemaId,
            }}
            onDraftRef={handleDraftRef}
            onDirtyChange={setDirty}
          />

          <RelationList
            relations={relations}
            objectTypes={allObjectTypes}
            currentTypeId={objectType.id}
            onAdd={() => setRelationDialogOpen(true)}
            onDelete={onDeleteRelation}
          />
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button size="sm" onClick={handleSave} disabled={busy || !dirty}>
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

      <RelationCreateDialog
        open={relationDialogOpen}
        onOpenChange={setRelationDialogOpen}
        onCreate={handleCreateRelation}
        objectTypes={allObjectTypes}
        sourceTypeId={objectType.id}
      />
    </div>
  );
}
