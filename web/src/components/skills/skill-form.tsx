"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import equal from "fast-deep-equal";
import useSWR from "swr";
import { SparklesIcon } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MdEditor } from "@/components/editors/md-editor";
import { PromptAssistDialog } from "@/components/model-config/prompt-assist-dialog";
import { useTools } from "@/lib/tools/hooks";
import { useDatasetVarsMap } from "@/lib/datasets/hooks";
import { wikiApiKey, wikiFetcher } from "@/lib/wiki/api";
import { BUILTIN_VAR_NAMES } from "@/lib/template";

interface SkillFormValues {
  name: string;
  description: string;
  content: string;
  enabled: boolean;
  order: number;
}

export interface SkillFormHandle {
  getDraft: () => SkillFormValues;
  reset: () => void;
}

interface SkillFormProps {
  skillKey: string;
  name: string;
  description: string;
  content: string;
  enabled: boolean;
  order: number;
  agentId: string;
  onDraftRef: (handle: SkillFormHandle) => void;
  onDirtyChange: (dirty: boolean) => void;
}

export function SkillForm({
  skillKey,
  name,
  description,
  content,
  enabled,
  order,
  agentId,
  onDraftRef,
  onDirtyChange,
}: SkillFormProps) {
  const defaults: SkillFormValues = { name, description, content, enabled, order };
  const originalRef = useRef(defaults);

  const form = useForm<SkillFormValues>({ defaultValues: defaults });
  const { register, control, getValues, reset, setValue } = form;

  // MdEditor is controlled, so manage content state separately
  const [contentValue, setContentValue] = useState(content);
  const [activeTab, setActiveTab] = useState("edit");
  const [previewContent, setPreviewContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [promptAssistOpen, setPromptAssistOpen] = useState(false);

  // Autocomplete data
  const { tools: allTools } = useTools(agentId);
  const { datasetVars } = useDatasetVarsMap(agentId);
  const { data: wikiDocs = [] } = useSWR(wikiApiKey(agentId), wikiFetcher);

  const allVariables = useMemo(() => {
    const datasetKeys = Object.keys(datasetVars);
    return [...BUILTIN_VAR_NAMES, ...datasetKeys];
  }, [datasetVars]);

  const completionTools = useMemo(
    () =>
      allTools
        .filter((t) => t.enabled)
        .map((t) => ({ name: t.name, description: t.description })),
    [allTools]
  );

  const completionDocs = useMemo(
    () => wikiDocs.map((d) => ({ title: d.name })),
    [wikiDocs]
  );

  const checkDirty = useCallback(() => {
    const dirty = !equal(originalRef.current, getValues());
    onDirtyChange(dirty);
  }, [getValues, onDirtyChange]);

  // Sync contentValue → form
  const handleContentChange = useCallback(
    (val: string) => {
      setContentValue(val);
      setValue("content", val);
      checkDirty();
    },
    [setValue, checkDirty]
  );

  useEffect(() => {
    onDraftRef({
      getDraft: () => getValues(),
      reset: () => {
        reset(originalRef.current);
        setContentValue(originalRef.current.content);
        onDirtyChange(false);
      },
    });
  }, [onDraftRef, getValues, reset, onDirtyChange]);

  // Preview handler
  const handlePreview = useCallback(async () => {
    if (!contentValue) {
      setPreviewContent("");
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/template/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: contentValue, agentId }),
      });
      const { rendered } = await res.json();
      setPreviewContent(rendered);
    } catch {
      setPreviewContent(contentValue);
    } finally {
      setPreviewLoading(false);
    }
  }, [contentValue, agentId]);

  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      if (value === "preview") {
        handlePreview();
      }
    },
    [handlePreview]
  );

  // AI 编辑 apply
  const handlePromptApply = useCallback(
    (newContent: string) => {
      handleContentChange(newContent);
    },
    [handleContentChange]
  );

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Key</label>
        <Input className="mt-1 h-8 text-sm font-mono" value={skillKey} readOnly />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Name</label>
        <Input
          className="mt-1 h-8 text-sm"
          {...register("name", { onChange: checkDirty })}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <Input
          className="mt-1 h-8 text-sm"
          {...register("description", { onChange: checkDirty })}
        />
      </div>

      <div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">提示词</label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-xs"
            onClick={() => setPromptAssistOpen(true)}
          >
            <SparklesIcon className="size-3" />
            AI 编辑
          </Button>
        </div>
        <PromptAssistDialog
          open={promptAssistOpen}
          onOpenChange={setPromptAssistOpen}
          systemPrompt={contentValue}
          onApply={handlePromptApply}
          agentId={agentId}
        />
        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-1">
          <TabsList className="h-7">
            <TabsTrigger value="edit" className="text-xs">Edit</TabsTrigger>
            <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="edit">
            <MdEditor
              height="300px"
              value={contentValue}
              onChange={handleContentChange}
              variables={allVariables}
              documents={completionDocs}
              tools={completionTools}
              placeholder="Enter skill content... (supports {{variables}}, {{lookup &quot;key&quot;}}, {{include &quot;doc&quot;}})"
            />
          </TabsContent>
          <TabsContent value="preview">
            <div className="min-h-[200px] max-h-[50vh] overflow-y-auto rounded-md border p-3">
              {previewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="size-5" />
                </div>
              ) : previewContent ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <Markdown remarkPlugins={[remarkGfm]}>{previewContent}</Markdown>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No content to preview</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Order</label>
        <Input
          className="mt-1 h-8 w-24 text-sm"
          type="number"
          {...register("order", { valueAsNumber: true, onChange: checkDirty })}
        />
      </div>
    </div>
  );
}
