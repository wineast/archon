"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export interface DataObjectFormHandle {
  getDraft: () => {
    name: string;
    description: string;
    data: Record<string, unknown>;
  };
  isDirty: () => boolean;
  reset: () => void;
}

interface DataObjectFormProps {
  objectKey: string;
  name: string;
  description: string;
  data: Record<string, unknown>;
  agentId: string | null;
  onDraftRef: (ref: DataObjectFormHandle) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function DataObjectForm({
  objectKey,
  name: initialName,
  description: initialDescription,
  data: initialData,
  agentId,
  onDraftRef,
  onDirtyChange,
}: DataObjectFormProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [dataText, setDataText] = useState(() =>
    JSON.stringify(initialData, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("edit");
  const [previewContent, setPreviewContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const originalRef = useRef(
    JSON.stringify({
      name: initialName,
      description: initialDescription,
      data: JSON.stringify(initialData, null, 2),
    })
  );

  const nameRef = useRef(name);
  nameRef.current = name;
  const descRef = useRef(description);
  descRef.current = description;
  const dataTextRef = useRef(dataText);
  dataTextRef.current = dataText;

  const parseData = useCallback((text: string): Record<string, unknown> => {
    try {
      return JSON.parse(text);
    } catch {
      return {};
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
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setDataText(val);
      try {
        JSON.parse(val);
        setJsonError(null);
      } catch (err) {
        setJsonError((err as Error).message);
      }
    },
    []
  );

  const handlePreview = useCallback(async () => {
    if (!dataText) {
      setPreviewContent("");
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/template/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: dataText, agentId }),
      });
      const { rendered } = await res.json();
      setPreviewContent(rendered);
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
          value={objectKey}
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
          placeholder="What this data object contains..."
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Data (JSON)
        </label>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-1">
          <TabsList className="h-7">
            <TabsTrigger value="edit" className="text-xs">Edit</TabsTrigger>
            <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="edit">
            <Textarea
              className="min-h-[300px] resize-y font-mono text-xs"
              value={dataText}
              onChange={handleDataChange}
              placeholder="{}"
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
