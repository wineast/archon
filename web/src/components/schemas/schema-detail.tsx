"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { JsonEditor } from "@/components/editors/json-editor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchemaForm, type SchemaFormHandle, type SchemaFormValues } from "./schema-form";
import { SchemaPlayground } from "./schema-playground";
import { SchemaExamplesPanel } from "./schema-examples-panel";
import { SchemaTestCasesPanel } from "./schema-test-cases-panel";
import { useDatasetVarsMap } from "@/lib/datasets/hooks";
import type { SchemaRow } from "@/db/schema";
import type { PoolMeta } from "@/components/pool/types";
import { PoolRefBadge } from "@/components/pool/pool-ref-badge";
import { PoolRefBottomBar } from "@/components/pool/pool-ref-bottom-bar";

interface SchemaDetailProps {
  schema: SchemaRow;
  allSchemas: SchemaRow[];
  agentId?: string;
  onSave: (id: string, data: Omit<SchemaFormValues, "key">) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  poolMeta?: PoolMeta;
}

export function SchemaDetail({ schema, allSchemas, agentId, onSave, onDelete, poolMeta }: SchemaDetailProps) {
  const isPoolRef = !!poolMeta;
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const draftRef = useRef<SchemaFormHandle | null>(null);
  const handleDraftRef = useCallback((ref: SchemaFormHandle) => {
    draftRef.current = ref;
  }, []);
  const [dirty, setDirty] = useState(false);
  const [innerTab, setInnerTab] = useState<"edit" | "preview">("edit");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewJsonError, setPreviewJsonError] = useState<string | null>(null);
  const busy = saving || deleting;

  // AI assist context: summarize all schemas for the AI
  const schemaAssistContext = useMemo(() => {
    const lines = allSchemas
      .filter((s) => s.id !== schema.id)
      .map((s) => `- ${s.key}: ${s.name}${s.description ? ` — ${s.description}` : ""}`);
    return lines.length > 0
      ? `可引用的其他 Schema（通过 $ref: "#/$defs/key"）：\n${lines.join("\n")}`
      : undefined;
  }, [allSchemas, schema.id]);

  // Dataset variables for template autocompletion (keys + nested data)
  const { datasetVars } = useDatasetVarsMap(agentId);
  const templateVariableNames = useMemo(
    () => Object.keys(datasetVars),
    [datasetVars]
  );

  const handlePreview = useCallback(async () => {
    const params = draftRef.current?.getDraft().parameters ?? schema.parameters;
    const text = JSON.stringify(params, null, 2);
    setPreviewLoading(true);
    setPreviewJsonError(null);
    try {
      const res = await fetch("/api/schema/template/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, agentId }),
      });
      const { rendered } = await res.json();
      setPreviewContent(rendered);
      try {
        JSON.parse(rendered);
      } catch (err) {
        setPreviewJsonError((err as Error).message);
      }
    } catch {
      setPreviewContent(text);
    } finally {
      setPreviewLoading(false);
    }
  }, [schema.parameters, agentId]);

  const handleInnerTabChange = useCallback(
    (value: string) => {
      setInnerTab(value as "edit" | "preview");
      if (value === "preview") {
        handlePreview();
      }
    },
    [handlePreview]
  );

  const handleSave = useCallback(async () => {
    if (!draftRef.current) return;
    const draft = draftRef.current.getDraft();
    setSaving(true);
    try {
      await onSave(schema.id, {
        name: draft.name,
        description: draft.description,
        parameters: draft.parameters,
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
    <Tabs defaultValue="edit" className="flex h-full flex-col">
      <TabsList variant="line" className="shrink-0 px-4 pt-1">
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="examples">Examples</TabsTrigger>
        <TabsTrigger value="playground">Playground</TabsTrigger>
        <TabsTrigger value="test-cases">Test Cases</TabsTrigger>
      </TabsList>

      <TabsContent value="edit" className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
          <div className="p-4 min-w-0">
            {isPoolRef && (
              <div className="mb-3">
                <PoolRefBadge origin={poolMeta.origin} />
              </div>
            )}
            <SchemaForm
              schema={{
                key: schema.key,
                name: schema.name,
                description: schema.description,
                parameters: schema.parameters,
              }}
              onDraftRef={handleDraftRef}
              onDirtyChange={setDirty}
              parametersHidden={innerTab === "preview"}
              context={schemaAssistContext}
              templateVariableNames={templateVariableNames}
              templateVariableMap={datasetVars}
              agentId={agentId}
              readOnly={isPoolRef}
            >
              <Tabs
                value={innerTab}
                onValueChange={handleInnerTabChange}
              >
                <TabsList className="h-7">
                  <TabsTrigger value="edit" className="text-xs">Edit</TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
                </TabsList>
              </Tabs>
            </SchemaForm>

            {innerTab === "preview" && (
              previewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner />
                </div>
              ) : (
                <div className="space-y-2">
                  {previewJsonError && (
                    <p className="text-xs text-destructive">{previewJsonError}</p>
                  )}
                  <JsonEditor
                    value={previewContent}
                    height="400px"
                    readOnly
                  />
                </div>
              )
            )}
          </div>
        </ScrollArea>

        {isPoolRef && agentId ? (
          <PoolRefBottomBar
            agentId={agentId}
            refId={poolMeta.refId}
            resourceType="schema"
            onRemoved={() => onDelete(schema.id)}
          />
        ) : (
        <>
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
          title="Delete Schema"
          description={`Are you sure you want to delete "${schema.key}"? This action cannot be undone.`}
          onConfirm={handleDelete}
        />
        </>
        )}
      </TabsContent>

      <TabsContent value="examples" className="flex min-h-0 flex-1 flex-col">
        <SchemaExamplesPanel schemaId={schema.id} />
      </TabsContent>

      <TabsContent value="playground" className="flex min-h-0 flex-1 flex-col">
        <SchemaPlayground schemaId={schema.id} />
      </TabsContent>

      <TabsContent value="test-cases" className="flex min-h-0 flex-1 flex-col">
        <SchemaTestCasesPanel schemaId={schema.id} />
      </TabsContent>
    </Tabs>
  );
}

