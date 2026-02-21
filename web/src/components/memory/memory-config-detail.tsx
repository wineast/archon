"use client";

import { useCallback, useEffect, useState } from "react";
import deepEqual from "fast-deep-equal";
import { PlusIcon, RotateCcwIcon, SaveIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MEMORY_TYPE_PRESETS } from "@/db/schema";
import type { MemoryConfigRow, MemoryTypeDef } from "@/db/schema";
import { GuideDialog } from "@/components/ui/guide-dialog";
import injectionModeGuide from "../../../guide/memory-injection-mode.md";

interface MemoryConfigDetailProps {
  config: MemoryConfigRow | null;
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
}

const DEFAULTS = {
  autoExtract: false,
  extractionPrompt: "",
  maxMemoriesPerUser: 100,
  maxGlobalMemories: 1000,
  injectionMode: "system_prompt" as const,
  maxInjectedMemories: 10,
  decayEnabled: false,
  decayDays: 90,
  memoryTypeDefs: [] as MemoryTypeDef[],
};

export function MemoryConfigDetail({ config, onSave }: MemoryConfigDetailProps) {
  const [saving, setSaving] = useState(false);

  const initial = config ?? DEFAULTS;

  const [autoExtract, setAutoExtract] = useState(initial.autoExtract);
  const [extractionPrompt, setExtractionPrompt] = useState(initial.extractionPrompt);
  const [maxMemoriesPerUser, setMaxMemoriesPerUser] = useState(initial.maxMemoriesPerUser);
  const [maxGlobalMemories, setMaxGlobalMemories] = useState(initial.maxGlobalMemories);
  const [injectionMode, setInjectionMode] = useState(initial.injectionMode);
  const [maxInjectedMemories, setMaxInjectedMemories] = useState(initial.maxInjectedMemories);
  const [decayEnabled, setDecayEnabled] = useState(initial.decayEnabled);
  const [decayDays, setDecayDays] = useState(initial.decayDays);
  const [typeDefs, setTypeDefs] = useState<MemoryTypeDef[]>(initial.memoryTypeDefs ?? []);

  useEffect(() => {
    const src = config ?? DEFAULTS;
    setAutoExtract(src.autoExtract);
    setExtractionPrompt(src.extractionPrompt);
    setMaxMemoriesPerUser(src.maxMemoriesPerUser);
    setMaxGlobalMemories(src.maxGlobalMemories);
    setInjectionMode(src.injectionMode);
    setMaxInjectedMemories(src.maxInjectedMemories);
    setDecayEnabled(src.decayEnabled);
    setDecayDays(src.decayDays);
    setTypeDefs(src.memoryTypeDefs ?? []);
  }, [config]);

  const current = {
    autoExtract,
    extractionPrompt,
    maxMemoriesPerUser,
    maxGlobalMemories,
    injectionMode,
    maxInjectedMemories,
    decayEnabled,
    decayDays,
    memoryTypeDefs: typeDefs,
  };

  const original = {
    autoExtract: initial.autoExtract,
    extractionPrompt: initial.extractionPrompt,
    maxMemoriesPerUser: initial.maxMemoriesPerUser,
    maxGlobalMemories: initial.maxGlobalMemories,
    injectionMode: initial.injectionMode,
    maxInjectedMemories: initial.maxInjectedMemories,
    decayEnabled: initial.decayEnabled,
    decayDays: initial.decayDays,
    memoryTypeDefs: initial.memoryTypeDefs ?? [],
  };

  const dirty = !deepEqual(current, original);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      await onSave(config.id, current);
    } finally {
      setSaving(false);
    }
  }, [config, onSave, current]);

  const handleReset = useCallback(() => {
    const src = config ?? DEFAULTS;
    setAutoExtract(src.autoExtract);
    setExtractionPrompt(src.extractionPrompt);
    setMaxMemoriesPerUser(src.maxMemoriesPerUser);
    setMaxGlobalMemories(src.maxGlobalMemories);
    setInjectionMode(src.injectionMode);
    setMaxInjectedMemories(src.maxInjectedMemories);
    setDecayEnabled(src.decayEnabled);
    setDecayDays(src.decayDays);
    setTypeDefs(src.memoryTypeDefs ?? []);
  }, [config]);

  const existingKeys = new Set(typeDefs.map((t) => t.key));

  const handleAddPreset = useCallback(
    (preset: MemoryTypeDef) => {
      if (existingKeys.has(preset.key)) return;
      setTypeDefs((prev) => [...prev, { ...preset }]);
    },
    [existingKeys]
  );

  const handleAddBlank = useCallback(() => {
    setTypeDefs((prev) => [
      ...prev,
      { key: "", description: "" },
    ]);
  }, []);

  const handleUpdateType = useCallback(
    (index: number, field: keyof MemoryTypeDef, value: string) => {
      setTypeDefs((prev) =>
        prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
      );
    },
    []
  );

  const handleRemoveType = useCallback((index: number) => {
    setTypeDefs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  if (!config) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No memory config yet. Use Build Chat to create one.
      </div>
    );
  }

  const availablePresets = MEMORY_TYPE_PRESETS.filter(
    (p) => !existingKeys.has(p.key)
  );

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 p-4">
          {/* Memory Type Definitions */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Memory Types</label>
              <p className="text-xs text-muted-foreground">
                Define memory types with descriptions. AI will use these to classify and extract memories.
              </p>
            </div>

            {/* Quick presets */}
            {availablePresets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {availablePresets.map((p) => (
                  <Button
                    key={p.key}
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => handleAddPreset(p)}
                  >
                    <PlusIcon className="mr-1 size-3" />
                    {p.key}
                  </Button>
                ))}
              </div>
            )}

            {/* Type list */}
            <div className="space-y-3">
              {typeDefs.map((td, i) => (
                <div
                  key={i}
                  className="rounded-lg border p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-7 text-xs font-mono flex-1"
                      value={td.key}
                      onChange={(e) =>
                        handleUpdateType(
                          i,
                          "key",
                          e.target.value
                            .toLowerCase()
                            .replace(/\s+/g, "_")
                            .replace(/[^a-z0-9_]/g, "")
                        )
                      }
                      placeholder="key"
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemoveType(i)}
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                  <Input
                    className="h-7 text-xs"
                    value={td.description}
                    onChange={(e) =>
                      handleUpdateType(i, "description", e.target.value)
                    }
                    placeholder="Description — tell AI what this type means"
                  />
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleAddBlank}
            >
              <PlusIcon className="mr-1 size-3" />
              Add Type
            </Button>
          </div>

          {/* Auto Extract */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Auto Extract</label>
              <p className="text-xs text-muted-foreground">
                Automatically extract memories from conversations
              </p>
            </div>
            <Switch checked={autoExtract} onCheckedChange={setAutoExtract} />
          </div>

          {/* Extraction Prompt */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Extraction Prompt</label>
            <Textarea
              value={extractionPrompt}
              onChange={(e) => setExtractionPrompt(e.target.value)}
              placeholder="Custom prompt for memory extraction..."
              rows={3}
            />
          </div>

          {/* Injection Mode */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <label className="text-sm font-medium">Injection Mode</label>
              <GuideDialog
                title="Injection Mode"
                content={injectionModeGuide}
              />
            </div>
            <Select value={injectionMode} onValueChange={(v) => setInjectionMode(v as typeof injectionMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system_prompt">System Prompt</SelectItem>
                <SelectItem value="context">Context</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Max Injected Memories */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Max Injected Memories</label>
            <Input
              type="number"
              value={maxInjectedMemories}
              onChange={(e) => setMaxInjectedMemories(Number(e.target.value))}
              min={0}
            />
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Per User</label>
              <Input
                type="number"
                value={maxMemoriesPerUser}
                onChange={(e) => setMaxMemoriesPerUser(Number(e.target.value))}
                min={0}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Global</label>
              <Input
                type="number"
                value={maxGlobalMemories}
                onChange={(e) => setMaxGlobalMemories(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>

          {/* Decay */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Memory Decay</label>
              <p className="text-xs text-muted-foreground">
                Auto-expire old memories
              </p>
            </div>
            <Switch checked={decayEnabled} onCheckedChange={setDecayEnabled} />
          </div>

          {decayEnabled && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Decay Days</label>
              <Input
                type="number"
                value={decayDays}
                onChange={(e) => setDecayDays(Number(e.target.value))}
                min={1}
              />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Bottom bar */}
      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
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
          disabled={saving || !dirty}
        >
          <RotateCcwIcon className="mr-1 size-3" />
          Reset
        </Button>
      </div>
    </div>
  );
}