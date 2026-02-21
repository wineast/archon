"use client";

import { useCallback, useMemo, useState } from "react";
import deepEqual from "fast-deep-equal";
import {
  CheckIcon,
  PlusIcon,
  PowerIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { TemplateTextarea } from "@/components/ui/template-textarea";
import { useDatasetVarsMap } from "@/lib/datasets/hooks";
import { useTools } from "@/lib/tools/hooks";
import { BUILTIN_VAR_NAMES } from "@/lib/template";
import { wikiApiKey, wikiFetcher } from "@/lib/wiki/api";
import { ModelCombobox } from "@/components/model-config/model-combobox";
import type { EvalJudgeConfigRow } from "@/db/schema";
import type { Dimension } from "@/lib/eval/types";

interface JudgeConfigDetailProps {
  config: EvalJudgeConfigRow;
  agentId?: string;
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSetDefault: (id: string) => Promise<void>;
}

export function JudgeConfigDetail({
  config,
  agentId,
  onSave,
  onDelete,
  onSetDefault,
}: JudgeConfigDetailProps) {
  const [name, setName] = useState(config.name);
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt);
  const [model, setModel] = useState(config.model);
  const [temperature, setTemperature] = useState(config.temperature);
  const [dimensions, setDimensions] = useState<Dimension[]>(config.dimensions);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = saving || deleting || settingDefault;

  const { datasetVars } = useDatasetVarsMap(agentId);
  const { tools: toolDefinitions } = useTools(agentId);
  const { data: wikiDocs = [] } = useSWR(wikiApiKey(agentId), wikiFetcher);

  const allVariables = useMemo(() => {
    const toolNames = toolDefinitions
      .filter((d) => d.enabled)
      .map((d) => d.name);
    const datasetKeys = Object.keys(datasetVars);
    return [...BUILTIN_VAR_NAMES, ...toolNames, ...datasetKeys];
  }, [toolDefinitions, datasetVars]);

  const completionDocs = useMemo(
    () => wikiDocs.map((d) => ({ title: d.name })),
    [wikiDocs]
  );

  const dirty =
    name !== config.name ||
    systemPrompt !== config.systemPrompt ||
    model !== config.model ||
    temperature !== config.temperature ||
    !deepEqual(dimensions, config.dimensions);

  const handleReset = useCallback(() => {
    setName(config.name);
    setSystemPrompt(config.systemPrompt);
    setModel(config.model);
    setTemperature(config.temperature);
    setDimensions(config.dimensions);
  }, [config.name, config.systemPrompt, config.model, config.temperature, config.dimensions]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(config.id, { name, systemPrompt, model, temperature, dimensions });
    } finally {
      setSaving(false);
    }
  }, [config.id, name, systemPrompt, model, temperature, dimensions, onSave]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(config.id);
    } finally {
      setDeleting(false);
    }
  }, [config.id, onDelete]);

  const handleSetDefault = useCallback(async () => {
    setSettingDefault(true);
    try {
      await onSetDefault(config.id);
    } finally {
      setSettingDefault(false);
    }
  }, [config.id, onSetDefault]);

  const handleAddDimension = useCallback(() => {
    setDimensions((prev) => [
      ...prev,
      { key: "", label: "", weight: 1, min: 1, max: 10 },
    ]);
  }, []);

  const handleRemoveDimension = useCallback((index: number) => {
    setDimensions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDimensionChange = useCallback(
    (index: number, field: keyof Dimension, value: string | number) => {
      setDimensions((prev) =>
        prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
      );
    },
    []
  );

  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="space-y-4 p-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Key
            </label>
            <Input
              className="mt-1 h-8 text-sm font-mono bg-muted"
              value={config.key}
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
              placeholder="Config name..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Judge System Prompt
            </label>
            <TemplateTextarea
              className="mt-1"
              height="300px"
              value={systemPrompt}
              onChange={setSystemPrompt}
              variables={allVariables}
              variableMap={datasetVars}
              documents={completionDocs}
              placeholder="Judge system prompt... (supports {{variables}}, {{lookup &quot;key&quot;}}, {{include &quot;doc&quot;}})"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Judge Model ID
            </label>
            <ModelCombobox
              className="mt-1"
              value={model}
              onChange={setModel}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Temperature
            </label>
            <Input
              className="mt-1 h-8 w-24 text-sm"
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) =>
                setTemperature(parseFloat(e.target.value) || 0)
              }
            />
          </div>

          {/* Dimensions */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Scoring Dimensions
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={handleAddDimension}
              >
                <PlusIcon className="mr-1 size-3" />
                Add
              </Button>
            </div>
            {dimensions.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground italic">
                No dimensions configured. A default &quot;overall&quot; dimension will be used at runtime.
              </p>
            )}
            {dimensions.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-[1fr_1fr_60px_50px_50px_28px] gap-1.5 text-[10px] font-medium text-muted-foreground px-0.5">
                  <span>Key</span>
                  <span>Label</span>
                  <span>Weight</span>
                  <span>Min</span>
                  <span>Max</span>
                  <span />
                </div>
                {dimensions.map((dim, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_1fr_60px_50px_50px_28px] gap-1.5 items-center"
                  >
                    <Input
                      className="h-7 text-xs"
                      value={dim.key}
                      onChange={(e) =>
                        handleDimensionChange(i, "key", e.target.value)
                      }
                      placeholder="accuracy"
                    />
                    <Input
                      className="h-7 text-xs"
                      value={dim.label}
                      onChange={(e) =>
                        handleDimensionChange(i, "label", e.target.value)
                      }
                      placeholder="Accuracy"
                    />
                    <Input
                      className="h-7 text-xs"
                      type="number"
                      step="0.1"
                      min="0"
                      value={dim.weight}
                      onChange={(e) =>
                        handleDimensionChange(
                          i,
                          "weight",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                    <Input
                      className="h-7 text-xs"
                      type="number"
                      step="1"
                      min="0"
                      value={dim.min ?? 1}
                      onChange={(e) =>
                        handleDimensionChange(
                          i,
                          "min",
                          parseInt(e.target.value) || 0
                        )
                      }
                    />
                    <Input
                      className="h-7 text-xs"
                      type="number"
                      step="1"
                      min="0"
                      value={dim.max ?? 10}
                      onChange={(e) =>
                        handleDimensionChange(
                          i,
                          "max",
                          parseInt(e.target.value) || 1
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemoveDimension(i)}
                    >
                      <XIcon className="size-3" />
                    </Button>
                  </div>
                ))}
                {totalWeight > 0 && (
                  <p className="text-[10px] text-muted-foreground px-0.5">
                    Total weight: {Math.round(totalWeight * 100) / 100}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Bottom bar */}
      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button
          variant={config.isDefault ? "outline" : "ghost"}
          size="sm"
          onClick={handleSetDefault}
          disabled={busy || config.isDefault}
        >
          {settingDefault ? (
            <Spinner className="mr-1 size-3" />
          ) : config.isDefault ? (
            <CheckIcon className="mr-1 size-3" />
          ) : (
            <PowerIcon className="mr-1 size-3" />
          )}
          {config.isDefault ? "Default" : "Set as Default"}
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
        <div className="flex-1" />
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={busy || config.isDefault}
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
        title="Delete Judge Config"
        description={`Are you sure you want to delete "${config.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
