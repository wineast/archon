"use client";

import { useCallback, useRef, useState } from "react";
import { BracesIcon, CodeIcon, RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { SchemaForm, type SchemaFormHandle, type SchemaFormValues } from "./schema-form";
import { SchemaJsonDialog } from "./schema-json-dialog";
import { SchemaZodDialog } from "./schema-zod-dialog";
import type { SchemaWithIncludes } from "@/db/schema";

interface SchemaDetailProps {
  schema: SchemaWithIncludes;
  allSchemas: SchemaWithIncludes[];
  agentId?: string;
  onSave: (id: string, data: Omit<SchemaFormValues, "key">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function SchemaDetail({ schema, allSchemas, agentId, onSave, onDelete }: SchemaDetailProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const draftRef = useRef<SchemaFormHandle | null>(null);
  const handleDraftRef = useCallback((ref: SchemaFormHandle) => {
    draftRef.current = ref;
  }, []);
  const [dirty, setDirty] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [zodOpen, setZodOpen] = useState(false);
  const busy = saving || deleting;

  const handleSave = useCallback(async () => {
    if (!draftRef.current) return;
    const draft = draftRef.current.getDraft();
    setSaving(true);
    try {
      await onSave(schema.id, {
        name: draft.name,
        description: draft.description,
        parameters: draft.parameters,
        includeSchemaIds: draft.includeSchemaIds,
      });
      draftRef.current?.markClean();
    } finally {
      setSaving(false);
    }
  }, [schema.id, onSave]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(schema.id);
    } finally {
      setDeleting(false);
    }
  }, [schema.id, onDelete]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-4 min-w-0">
          <SchemaForm
            schema={{
              key: schema.key,
              name: schema.name,
              description: schema.description,
              parameters: schema.parameters,
              includeSchemaIds: schema.includeSchemaIds,
            }}
            onDraftRef={handleDraftRef}
            onDirtyChange={setDirty}
            allSchemas={allSchemas}
            currentSchemaId={schema.id}
            agentId={agentId}
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
          variant="outline"
          size="sm"
          onClick={() => setZodOpen(true)}
        >
          <CodeIcon className="mr-1 size-3" />
          Zod Code
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setJsonOpen(true)}
        >
          <BracesIcon className="mr-1 size-3" />
          JSON Schema
        </Button>
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

      <SchemaJsonDialog
        open={jsonOpen}
        onOpenChange={setJsonOpen}
        schemaKey={schema.key}
        getParameters={() => draftRef.current?.getDraft().parameters ?? schema.parameters}
        allSchemas={allSchemas}
      />
      <SchemaZodDialog
        open={zodOpen}
        onOpenChange={setZodOpen}
        schemaKey={schema.key}
        getParameters={() => draftRef.current?.getDraft().parameters ?? schema.parameters}
        allSchemas={allSchemas}
      />
    </div>
  );
}
