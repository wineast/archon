"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { CheckIcon, CopyIcon, DownloadIcon, RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonEditor } from "@/components/editors/json-editor";
import { JsEditor } from "@/components/editors/js-editor";
import { SchemaForm, type SchemaFormHandle, type SchemaFormValues } from "./schema-form";
import { SchemaPlayground } from "./schema-playground";
import { SchemaTestCasesPanel } from "./schema-test-cases-panel";
import { buildZodCode } from "@/lib/tools/zod-code-builder";
import { buildJsonSchema } from "@/lib/tools/schema-builder";
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
  const [innerTab, setInnerTab] = useState<"edit" | "preview">("edit");
  const [confirmOpen, setConfirmOpen] = useState(false);
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
    <Tabs defaultValue="edit" className="flex h-full flex-col">
      <TabsList variant="line" className="shrink-0 px-4 pt-1">
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="playground">Playground</TabsTrigger>
        <TabsTrigger value="test-cases">Test Cases</TabsTrigger>
      </TabsList>

      <TabsContent value="edit" className="flex min-h-0 flex-1 flex-col">
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
              parametersHidden={innerTab === "preview"}
            >
              <Tabs
                value={innerTab}
                onValueChange={(v) => setInnerTab(v as "edit" | "preview")}
              >
                <TabsList className="h-7">
                  <TabsTrigger value="edit" className="text-xs">Edit</TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
                </TabsList>
              </Tabs>
            </SchemaForm>

            {innerTab === "preview" && (
              <SchemaPreviewPanel
                schemaKey={schema.key}
                getParameters={() => draftRef.current?.getDraft().parameters ?? schema.parameters}
                allSchemas={allSchemas}
              />
            )}
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

/* ------------------------------------------------------------------ */
/*  Preview panel with Zod / JSON sub-tabs                            */
/* ------------------------------------------------------------------ */

interface SchemaPreviewPanelProps {
  schemaKey: string;
  getParameters: () => import("@/lib/schemas/types").SchemaProperty[];
  allSchemas: SchemaWithIncludes[];
}

function SchemaPreviewPanel({ schemaKey, getParameters, allSchemas }: SchemaPreviewPanelProps) {
  const [codeTab, setCodeTab] = useState<"zod" | "json">("zod");

  const parameters = getParameters();

  const schemaMap = useMemo(() => {
    const map: Record<string, import("@/lib/schemas/types").SchemaProperty[]> = {};
    for (const s of allSchemas) {
      map[s.id] = s.parameters;
    }
    return map;
  }, [allSchemas]);

  const schemaKeyMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of allSchemas) {
      map[s.id] = s.key;
    }
    return map;
  }, [allSchemas]);

  const zodCode = useMemo(
    () => buildZodCode(parameters, { schemaMap, schemaKeyMap }),
    [parameters, schemaMap, schemaKeyMap]
  );

  const jsonText = useMemo(() => {
    const jsonSchema = buildJsonSchema(parameters, { schemaMap });
    return JSON.stringify(jsonSchema, null, 2);
  }, [parameters, schemaMap]);

  const currentCode = codeTab === "zod" ? zodCode : jsonText;
  const currentLang = codeTab === "zod" ? "typescript" : "json";
  const currentFilename = codeTab === "zod" ? `${schemaKey}.ts` : `${schemaKey}.json`;
  const currentMimeType = codeTab === "zod" ? "text/typescript" : "application/json";

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleExport = () => {
    const blob = new Blob([currentCode], { type: currentMimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Tabs
      value={codeTab}
      onValueChange={(v) => setCodeTab(v as "zod" | "json")}
      className="mt-3"
    >
      <div className="flex items-center gap-2">
        <TabsList className="h-7">
          <TabsTrigger value="zod" className="text-xs">Zod Code</TabsTrigger>
          <TabsTrigger value="json" className="text-xs">JSON Schema</TabsTrigger>
        </TabsList>
        <div className="flex-1" />
        <Button size="icon" variant="ghost" className="size-7" onClick={handleCopy}>
          {copied ? <CheckIcon className="size-3.5 text-green-500" /> : <CopyIcon className="size-3.5" />}
        </Button>
        <Button size="icon" variant="ghost" className="size-7" onClick={handleExport}>
          <DownloadIcon className="size-3.5" />
        </Button>
      </div>

      <TabsContent value="zod">
        <JsEditor value={zodCode} readOnly height="400px" />
      </TabsContent>

      <TabsContent value="json">
        <JsonEditor value={jsonText} readOnly height="400px" />
      </TabsContent>
    </Tabs>
  );
}
