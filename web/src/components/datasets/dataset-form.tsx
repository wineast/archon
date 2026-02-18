"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonEditor } from "@/components/ui/editors/json-editor";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDatasetVarsMap } from "@/lib/datasets/hooks";
import { BUILTIN_VAR_NAMES } from "@/lib/template";

export interface DatasetFormHandle {
  getDraft: () => {
    name: string;
    description: string;
    layer: number;
    data: unknown;
  };
  isDirty: () => boolean;
  reset: () => void;
}

interface DatasetFormProps {
  datasetKey: string;
  name: string;
  description: string;
  layer: number;
  data: unknown;
  agentId: string | null;
  onDraftRef: (ref: DatasetFormHandle) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function DatasetForm({
  datasetKey,
  name: initialName,
  description: initialDescription,
  layer: initialLayer,
  data: initialData,
  agentId,
  onDraftRef,
  onDirtyChange,
}: DatasetFormProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [layer, setLayer] = useState(initialLayer);
  const [dataText, setDataText] = useState(() =>
    typeof initialData === "string"
      ? JSON.stringify(initialData)
      : JSON.stringify(initialData, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("edit");
  const [previewContent, setPreviewContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewJsonError, setPreviewJsonError] = useState<string | null>(null);

  const originalRef = useRef(
    JSON.stringify({
      name: initialName,
      description: initialDescription,
      layer: initialLayer,
      data: typeof initialData === "string"
        ? JSON.stringify(initialData)
        : JSON.stringify(initialData, null, 2),
    })
  );

  const nameRef = useRef(name);
  nameRef.current = name;
  const descRef = useRef(description);
  descRef.current = description;
  const layerRef = useRef(layer);
  layerRef.current = layer;
  const dataTextRef = useRef(dataText);
  dataTextRef.current = dataText;

  const parseData = useCallback((text: string, forLayer: number): unknown => {
    try {
      return JSON.parse(text);
    } catch {
      // Layer 1: template text that isn't valid JSON → store as string
      return forLayer === 1 ? text : {};
    }
  }, []);

  useEffect(() => {
    onDraftRef({
      getDraft: () => ({
        name: nameRef.current,
        description: descRef.current,
        layer: layerRef.current,
        data: parseData(dataTextRef.current, layerRef.current),
      }),
      isDirty: () =>
        JSON.stringify({
          name: nameRef.current,
          description: descRef.current,
          layer: layerRef.current,
          data: dataTextRef.current,
        }) !== originalRef.current,
      reset: () => {
        const original = JSON.parse(originalRef.current);
        setName(original.name);
        setDescription(original.description);
        setLayer(original.layer);
        setDataText(original.data);
        setJsonError(null);
      },
    });
  }, [onDraftRef, parseData]);

  useEffect(() => {
    const current = JSON.stringify({
      name,
      description,
      layer,
      data: dataText,
    });
    onDirtyChange?.(current !== originalRef.current);
  }, [name, description, layer, dataText, onDirtyChange]);

  const handleDataChange = useCallback(
    (val: string) => {
      setDataText(val);
      // Layer 1 is a Liquid template — skip JSON validation
      if (layerRef.current === 1) {
        setJsonError(null);
        return;
      }
      try {
        JSON.parse(val);
        setJsonError(null);
      } catch (err) {
        setJsonError((err as Error).message);
      }
    },
    []
  );

  // Template editor completions for Layer 1
  const { datasetVars } = useDatasetVarsMap(agentId ?? undefined);
  const templateVariables = useMemo(() => {
    const datasetKeys = Object.keys(datasetVars);
    return [...BUILTIN_VAR_NAMES, ...datasetKeys];
  }, [datasetVars]);

  const handlePreview = useCallback(async () => {
    if (!dataText) {
      setPreviewContent("");
      setPreviewJsonError(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewJsonError(null);
    try {
      const res = await fetch("/api/template/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: dataText, agentId }),
      });
      const { rendered } = await res.json();
      setPreviewContent(rendered);
      // Validate rendered output as JSON
      try {
        JSON.parse(rendered);
      } catch (err) {
        setPreviewJsonError((err as Error).message);
      }
    } catch {
      setPreviewContent(dataText);
    } finally {
      setPreviewLoading(false);
    }
  }, [dataText, agentId]);

  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      if (value === "preview") {
        handlePreview();
      }
    },
    [handlePreview]
  );

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Key</label>
        <Input
          className="mt-1 h-8 text-sm font-mono bg-muted"
          value={datasetKey}
          readOnly
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Name
        </label>
        <Input
          className="mt-1 h-8 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Display name"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Description
        </label>
        <Textarea
          className="mt-1 min-h-[60px] resize-none text-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this dataset contains..."
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Layer
        </label>
        <Select
          value={String(layer)}
          onValueChange={(v) => {
            setLayer(Number(v));
            // Switching to Layer 1 clears JSON validation error
            if (Number(v) === 1) setJsonError(null);
          }}
        >
          <SelectTrigger className="mt-1 h-8 w-40 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0 — Base</SelectItem>
            <SelectItem value="1">1 — Derived</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Data {layer === 1 ? "(Template)" : "(JSON)"}
        </label>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-1">
          <TabsList className="h-7">
            <TabsTrigger value="edit" className="text-xs">Edit</TabsTrigger>
            <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="edit">
            <JsonEditor
              value={dataText}
              onChange={handleDataChange}
              height="300px"
              templateVariables={layer === 1 ? templateVariables : undefined}
            />
            {jsonError && (
              <p className="mt-1 text-xs text-destructive">{jsonError}</p>
            )}
          </TabsContent>
          <TabsContent value="preview">
            <div className="min-h-[300px] rounded-md border p-3">
              {previewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="size-5" />
                </div>
              ) : previewContent ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                  {previewContent}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">No content to preview</p>
              )}
            </div>
            {previewJsonError && (
              <p className="mt-1 text-xs text-destructive">
                Rendered output is not valid JSON: {previewJsonError}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
