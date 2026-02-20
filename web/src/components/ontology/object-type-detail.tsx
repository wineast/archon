"use client";

import { useCallback, useRef, useState } from "react";
import { RotateCcwIcon, SaveIcon, Trash2Icon, WandIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ObjectTypeForm,
  type ObjectTypeFormHandle,
  type ObjectTypeFormValues,
} from "./object-type-form";
import { RelationList } from "./relation-list";
import { RelationCreateDialog } from "./relation-create-dialog";
import { InstancesTab } from "./instances-tab";
import type { ObjectTypeRow, ObjectRelationRow, SchemaWithIncludes } from "@/db/schema";

interface ObjectTypeDetailProps {
  agentId: string;
  objectType: ObjectTypeRow;
  allObjectTypes: ObjectTypeRow[];
  relations: ObjectRelationRow[];
  schemas: SchemaWithIncludes[];
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
  onGenerateTools?: (id: string) => Promise<void>;
}

export function ObjectTypeDetail({
  agentId,
  objectType,
  allObjectTypes,
  relations,
  schemas,
  onSave,
  onDelete,
  onCreateRelation,
  onDeleteRelation,
  onGenerateTools,
}: ObjectTypeDetailProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const draftRef = useRef<ObjectTypeFormHandle | null>(null);
  const handleDraftRef = useCallback((ref: ObjectTypeFormHandle) => {
    draftRef.current = ref;
  }, []);
  const [dirty, setDirty] = useState(false);
  const [relationDialogOpen, setRelationDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = saving || deleting || generating;

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
        titleProperty: draft.titleProperty,
        source: draft.source,
        externalConfig: draft.externalConfig,
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

  const handleGenerateTools = useCallback(async () => {
    if (!onGenerateTools) return;
    setGenerating(true);
    try {
      await onGenerateTools(objectType.id);
    } finally {
      setGenerating(false);
    }
  }, [objectType.id, onGenerateTools]);

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
    <Tabs defaultValue="edit" className="flex h-full flex-col">
      <TabsList variant="line" className="shrink-0 px-4 pt-1">
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="instances">Instances</TabsTrigger>
      </TabsList>

      <TabsContent value="edit" className="flex min-h-0 flex-1 flex-col">
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
                titleProperty: objectType.titleProperty,
                source: objectType.source,
                externalConfig: objectType.externalConfig,
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
          {onGenerateTools && objectType.schemaId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateTools}
              disabled={busy}
            >
              {generating ? (
                <Spinner className="mr-1 size-3" />
              ) : (
                <WandIcon className="mr-1 size-3" />
              )}
              {generating ? "Generating..." : "Generate CRUD Tools"}
            </Button>
          )}
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
          title="Delete Object Type"
          description={`Are you sure you want to delete "${objectType.name}"? This action cannot be undone.`}
          onConfirm={handleDelete}
        />

        <RelationCreateDialog
          open={relationDialogOpen}
          onOpenChange={setRelationDialogOpen}
          onCreate={handleCreateRelation}
          objectTypes={allObjectTypes}
          sourceTypeId={objectType.id}
        />
      </TabsContent>

      <TabsContent value="instances" className="flex min-h-0 flex-1 flex-col">
        <InstancesTab
          agentId={agentId}
          objectType={objectType}
          schemas={schemas}
        />
      </TabsContent>
    </Tabs>
  );
}
