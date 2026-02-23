"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { GuideDialog } from "@/components/ui/guide-dialog";
import datasetDataGuide from "../../../guide/dataset-data.md";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyField } from "@/components/ui/key-field";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonEditor } from "@/components/editors/json-editor";
import { Textarea } from "@/components/ui/textarea";
import { useDatasetVarsMap } from "@/lib/datasets/hooks";
import { useAgentOrgId } from "@/lib/agents/hooks";
import { DatasetAssistDialog } from "./dataset-assist-dialog";

export interface DatasetFormHandle {
  getDraft: () => {
    name: string;
    description: string;
    data: unknown;
  };
  isDirty: () => boolean;
  reset: () => void;
  markSaved: () => void;
}

interface DatasetFormProps {
  datasetKey: string;
  name: string;
  description: string;
  data: unknown;
  agentId: string | null;
  onDraftRef: (ref: DatasetFormHandle) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** When true, all fields are disabled/readOnly. */
  readOnly?: boolean;
}

export function DatasetForm({
  datasetKey,
  name: initialName,
  description: initialDescription,
  data: initialData,
  agentId,
  onDraftRef,
  onDirtyChange,
  readOnly,
}: DatasetFormProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
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
      data: typeof initialData === "string"
        ? JSON.stringify(initialData)
        : JSON.stringify(initialData, null, 2),
    })
  );

  const nameRef = useRef(name);
  nameRef.current = name;
  const descRef = useRef(description);
  descRef.current = description;
  const dataTextRef = useRef(dataText);
  dataTextRef.current = dataText;

  const parseData = useCallback((text: string): unknown => {
    try {
      return JSON.parse(text);
    } catch {
      // Template text that isn't valid JSON → store as string
      return text;
    }
  }, []);

  useEffect(() => {
    onDraftRef({
      getDraft: () => ({
        name: nameRef.current,
        description: descRef.current,
        data: parseData(dataTextRef.current),
      }),
      isDirty: () =>
        JSON.stringify({
          name: nameRef.current,
          description: descRef.current,
          data: dataTextRef.current,
        }) !== originalRef.current,
      reset: () => {
        const original = JSON.parse(originalRef.current);
        setName(original.name);
        setDescription(original.description);
        setDataText(original.data);
        setJsonError(null);
      },
      markSaved: () => {
        originalRef.current = JSON.stringify({
          name: nameRef.current,
          description: descRef.current,
          data: dataTextRef.current,
        });
        onDirtyChange?.(false);
      },
    });
  }, [onDraftRef, parseData]);

  useEffect(() => {
    const current = JSON.stringify({
      name,
      description,
      data: dataText,
    });
    onDirtyChange?.(current !== originalRef.current);
  }, [name, description, dataText, onDirtyChange]);

  const handleDataChange = useCallback(
    (val: string) => {
      setDataText(val);
      // Contains Liquid template syntax → skip JSON validation
      if (/\{\{.*?\}\}|\{%.*?%\}/.test(val)) {
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

  // Template editor completions
  const { datasetVars } = useDatasetVarsMap(agentId ?? undefined);
  const templateVariables = useMemo(() => {
    return Object.keys(datasetVars);
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
        body: JSON.stringify({ text: dataText, agentId, mode: "dataset" }),
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

  const [assistOpen, setAssistOpen] = useState(false);
  const orgId = useAgentOrgId(agentId);

  return (
    <>
      <div className="space-y-3">
        <KeyField value={datasetKey} />
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Name
          </label>
          <Input
            className="mt-1 h-8 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
            disabled={readOnly}
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
            disabled={readOnly}
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Data (JSON / Template)
            </label>
            <GuideDialog title="Data 编辑指南" content={datasetDataGuide} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-xs"
              onClick={() => setAssistOpen(true)}
            >
              <SparklesIcon className="size-3" />
              AI 编辑
            </Button>
          </div>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-1">
            <TabsList className="h-7">
              <TabsTrigger value="edit" className="text-xs">Edit</TabsTrigger>
              <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="edit">
              <JsonEditor
                value={dataText}
                onChange={handleDataChange}
                height="500px"
                templateVariables={templateVariables}
                templateVariableMap={datasetVars}
                readOnly={readOnly}
              />
              {jsonError && (
                <p className="mt-1 text-xs text-destructive">{jsonError}</p>
              )}
            </TabsContent>
            <TabsContent value="preview">
              {previewLoading ? (
                <div className="flex min-h-[500px] items-center justify-center rounded-md border">
                  <Spinner className="size-5" />
                </div>
              ) : (
                <JsonEditor
                  value={previewContent}
                  height="500px"
                  readOnly
                />
              )}
              {previewJsonError && (
                <p className="mt-1 text-xs text-destructive">
                  Rendered output is not valid JSON: {previewJsonError}
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <DatasetAssistDialog
        open={assistOpen}
        onOpenChange={setAssistOpen}
        data={dataText}
        datasetName={name}
        datasetDescription={description}
        templateVariables={templateVariables}
        agentId={agentId ?? undefined}
        orgId={orgId}
        onApply={(newData) => handleDataChange(newData)}
      />
    </>
  );
}
