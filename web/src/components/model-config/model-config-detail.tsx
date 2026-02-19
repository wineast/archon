"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CheckIcon,
  DownloadIcon,
  PowerIcon,
  RotateCcwIcon,
  SaveIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MdEditor } from "@/components/editors/md-editor";
import type { ModelConfigRow } from "@/db/schema";
import { useDatasetVarsMap, useDatasets } from "@/lib/datasets/hooks";
import { useTools } from "@/lib/tools/hooks";
import { BUILTIN_VAR_NAMES } from "@/lib/template";
import { wikiApiKey, wikiFetcher } from "@/lib/wiki/api";
import { ModelCombobox } from "./model-combobox";
import { PromptAssistDialog } from "./prompt-assist-dialog";

interface ModelConfigDetailProps {
  config: ModelConfigRow;
  agentId?: string;
  onSave: (
    id: string,
    data: { name: string; modelId: string; systemPrompt: string; temperature: number }
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onActivate: (id: string) => Promise<void>;
  onPull?: () => Promise<ModelConfigRow | null>;
}

const isDev = process.env.NODE_ENV === "development";

export function ModelConfigDetail({
  config,
  agentId,
  onSave,
  onDelete,
  onActivate,
  onPull,
}: ModelConfigDetailProps) {
  const [name, setName] = useState(config.name);
  const [modelId, setModelId] = useState(config.modelId);
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt);
  const [temperature, setTemperature] = useState(config.temperature);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("edit");
  const [promptAssistOpen, setPromptAssistOpen] = useState(false);
  const busy = saving || deleting || activating || pulling;

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
    () => wikiDocs.map((d) => ({ title: d.title })),
    [wikiDocs]
  );


  const dirty =
    name !== config.name ||
    modelId !== config.modelId ||
    systemPrompt !== config.systemPrompt ||
    temperature !== config.temperature;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(config.id, { name, modelId, systemPrompt, temperature });
    } finally {
      setSaving(false);
    }
  }, [config.id, name, modelId, systemPrompt, temperature, onSave]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(config.id);
    } finally {
      setDeleting(false);
    }
  }, [config.id, onDelete]);

  const handleReset = useCallback(() => {
    setName(config.name);
    setModelId(config.modelId);
    setSystemPrompt(config.systemPrompt);
    setTemperature(config.temperature);
  }, [config.name, config.modelId, config.systemPrompt, config.temperature]);

  const handlePreview = useCallback(async () => {
    if (!systemPrompt) {
      setPreviewContent("");
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/template/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: systemPrompt, agentId: config.agentId }),
      });
      const { rendered } = await res.json();
      setPreviewContent(rendered);
    } catch {
      setPreviewContent(systemPrompt);
    } finally {
      setPreviewLoading(false);
    }
  }, [systemPrompt, config.agentId]);

  const handleActivate = useCallback(async () => {
    setActivating(true);
    try {
      await onActivate(config.id);
    } finally {
      setActivating(false);
    }
  }, [config.id, onActivate]);

  const handlePull = useCallback(async () => {
    if (!onPull) return;
    setPulling(true);
    try {
      const fresh = await onPull();
      if (fresh) {
        setName(fresh.name);
        setModelId(fresh.modelId);
        setSystemPrompt(fresh.systemPrompt);
        setTemperature(fresh.temperature);
      }
    } finally {
      setPulling(false);
    }
  }, [onPull]);


  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    if (value === "preview") {
      handlePreview();
    }
  }, [handlePreview]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 p-4">
          <div>
            <label className="text-sm font-medium">Key</label>
            <Input
              className="mt-1.5 h-8 text-sm font-mono bg-muted"
              value={config.key}
              readOnly
            />
          </div>
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              className="mt-1.5 h-8 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Model ID</label>
            <ModelCombobox
              className="mt-1.5"
              value={modelId}
              onChange={setModelId}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">System Prompt</label>
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
              systemPrompt={systemPrompt}
              onApply={setSystemPrompt}
            />
            <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-1.5">
              <TabsList className="h-8">
                <TabsTrigger value="edit" className="text-xs">Edit</TabsTrigger>
                <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <MdEditor
                  className="min-h-[200px] max-h-[50vh] overflow-y-auto"
                  value={systemPrompt}
                  onChange={setSystemPrompt}
                  variables={allVariables}
                  documents={completionDocs}

                  tools={completionTools}
                  placeholder="Enter system prompt... (supports {{variables}}, {{lookup &quot;key&quot;}}, {{include &quot;doc&quot;}})"
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
            <label className="text-sm font-medium">Temperature</label>
            <div className="mt-1.5 flex items-center gap-3">
              <Input
                className="h-8 w-20 text-sm"
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={temperature}
                onChange={(e) =>
                  setTemperature(
                    Math.min(2, Math.max(0, parseFloat(e.target.value) || 0))
                  )
                }
              />
              <span className="text-xs text-muted-foreground">
                0 = more precise, 2 = more creative
              </span>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Bottom bar */}
      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button
          variant={config.isActive ? "outline" : "ghost"}
          size="sm"
          onClick={handleActivate}
          disabled={busy || config.isActive}
        >
          {activating ? (
            <Spinner className="mr-1 size-3" />
          ) : config.isActive ? (
            <CheckIcon className="mr-1 size-3" />
          ) : (
            <PowerIcon className="mr-1 size-3" />
          )}
          {config.isActive ? "Active" : "Activate"}
        </Button>
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
          onClick={handleReset}
          disabled={busy || !dirty}
        >
          <RotateCcwIcon className="mr-1 size-3" />
          Reset
        </Button>
        {isDev && onPull && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePull}
            disabled={busy}
          >
            {pulling ? (
              <Spinner className="mr-1 size-3" />
            ) : (
              <DownloadIcon className="mr-1 size-3" />
            )}
            {pulling ? "Pulling..." : "Pull"}
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={busy || config.isActive}
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
