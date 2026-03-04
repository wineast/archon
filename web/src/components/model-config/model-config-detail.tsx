"use client";

import { useCallback, useMemo, useState } from "react";
import {
  RotateCcwIcon,
  SaveIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GuideDialog } from "@/components/ui/guide-dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MdEditor } from "@/components/editors/md-editor";
import promptEditingGuide from "../../../guide/prompt-editing.md";
import type { ModelConfigRow } from "@/db/schema";
import { useDatasetVarsMap, useDatasets } from "@/lib/datasets/hooks";
import { useTools } from "@/lib/tools/hooks";
import { useFunctions } from "@/lib/functions/hooks";
import { TIME_VAR_NAMES } from "@/lib/template";
import { wikiApiKey, wikiFetcher } from "@/lib/wiki/api";
import { useObjectTypes } from "@/lib/ontology/hooks";
import { useOrgConfiguredProviders } from "@/lib/orgs/configured-providers-hooks";
import { getDisabledProviders } from "@/lib/models/get-disabled-providers";
import { useModels } from "@/lib/models/hooks";
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
}

export function ModelConfigDetail({
  config,
  agentId,
  onSave,
  onDelete,
  onActivate,
}: ModelConfigDetailProps) {
  const [name, setName] = useState(config.name);
  const [modelId, setModelId] = useState(config.modelId);
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt);
  const [temperature, setTemperature] = useState(config.temperature);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("edit");
  const [promptAssistOpen, setPromptAssistOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = saving || deleting || activating;

  // Get orgId from agent for provider filtering
  const { data: agentData } = useSWR<{ orgId: string }>(
    agentId ? `/api/agents/${agentId}` : null,
    (url: string) => fetch(url).then((r) => r.json())
  );
  const { configuredProviders } = useOrgConfiguredProviders(agentData?.orgId);
  const { models: allModels } = useModels();
  const disabledProviders = useMemo(
    () => getDisabledProviders(allModels.map((m) => m.provider), configuredProviders),
    [allModels, configuredProviders]
  );

  const { tools: allTools } = useTools(agentId);
  const { functions: allFunctions } = useFunctions(agentId);
  const { datasetVars } = useDatasetVarsMap(agentId);
  const { data: wikiDocs = [] } = useSWR(wikiApiKey(agentId), wikiFetcher);
  const { objectTypes } = useObjectTypes(agentId);

  const allVariables = useMemo(() => {
    const datasetKeys = Object.keys(datasetVars);
    return [...TIME_VAR_NAMES, ...datasetKeys];
  }, [datasetVars]);

  const completionTools = useMemo(
    () =>
      allTools
        .filter((t) => t.enabled)
        .map((t) => ({ name: t.name, description: t.description })),
    [allTools]
  );

  const completionDocs = useMemo(
    () => wikiDocs.map((d) => ({ key: d.key, title: d.name })),
    [wikiDocs]
  );

  const completionOntologyTypes = useMemo(
    () => objectTypes.map((t) => ({ key: t.key, name: t.name })),
    [objectTypes]
  );

  const completionFunctions = useMemo(
    () => allFunctions.map((f) => ({ key: f.key, name: f.name, description: f.description })),
    [allFunctions]
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

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    if (value === "preview") {
      handlePreview();
    }
  }, [handlePreview]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="space-y-4 p-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Key</label>
            <Input
              className="mt-1 h-8 text-sm font-mono bg-muted"
              value={config.key}
              readOnly
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input
              className="mt-1 h-8 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Model ID</label>
            <ModelCombobox
              className="mt-1"
              value={modelId}
              onChange={setModelId}
              disabledProviders={disabledProviders}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">System Prompt</label>
              <GuideDialog title="系统提示词编辑参考" content={promptEditingGuide} />
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
              agentId={agentId}
              orgId={agentData?.orgId}
            />
            <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-1">
              <TabsList className="h-7">
                <TabsTrigger value="edit" className="text-xs">Edit</TabsTrigger>
                <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <MdEditor
                  height="300px"
                  value={systemPrompt}
                  onChange={setSystemPrompt}
                  variables={allVariables}
                  variableMap={datasetVars}
                  documents={completionDocs}
                  tools={completionTools}
                  ontologyTypes={completionOntologyTypes}
                  functions={completionFunctions}
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
            <label className="text-xs font-medium text-muted-foreground">Temperature</label>
            <div className="mt-1 flex items-center gap-3">
              <Slider
                className="flex-1"
                value={[temperature]}
                onValueChange={([v]) => setTemperature(v)}
                min={0}
                max={2}
                step={0.1}
              />
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
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              0 = more precise, 2 = more creative
            </p>
          </div>
        </div>
      </ScrollArea>

      {/* Bottom bar */}
      <div className="flex items-center gap-2 border-t px-4 py-2">
        <div className="flex items-center gap-1.5">
          <Switch
            className="scale-75"
            checked={config.isActive}
            onCheckedChange={(checked) => {
              if (checked) handleActivate();
            }}
            disabled={busy || config.isActive}
            data-testid="switch-activate"
          />
          <span className="text-xs text-muted-foreground">
            {config.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={busy || !dirty}
          data-testid="btn-save"
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
        <div className="flex-1" />
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmOpen(true)}
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

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Model Config"
        description={`Are you sure you want to delete "${config.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
