"use client";

import { useCallback, useMemo, useState } from "react";
import { nanoid } from "nanoid";
import {
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
  PlusIcon,
  XIcon,
  UndoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { MdEditor } from "@/components/editors/md-editor";
import { GuideDialog } from "@/components/ui/guide-dialog";
import type { JudgeConfigRow } from "@/db/schema";
import type { Dimension } from "@/lib/eval/types";
import { DEFAULT_PROMPT_TEMPLATE, DEFAULT_TURN_PROMPT_TEMPLATE } from "@/lib/eval/judge-prompt";
import promptTemplateGuide from "../../../guide/judge-prompt-template.md";
import turnPromptTemplateGuide from "../../../guide/judge-turn-prompt-template.md";

interface JudgeConfigDetailProps {
  config: JudgeConfigRow;
  onSave: (id: string, data: { name: string; dimensions: Dimension[]; promptTemplate?: string | null; turnPromptTemplate?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onActivate: (id: string) => Promise<void>;
}

export function JudgeConfigDetail({
  config,
  onSave,
  onDelete,
  onActivate,
}: JudgeConfigDetailProps) {
  const [name, setName] = useState(config.name);
  const [dimensions, setDimensions] = useState<(Dimension & { _id: string })[]>(
    config.dimensions.map((d) => ({ ...d, _id: nanoid() }))
  );
  const [promptTemplate, setPromptTemplate] = useState(config.promptTemplate ?? "");
  const [turnPromptTemplate, setTurnPromptTemplate] = useState(config.turnPromptTemplate ?? "");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = saving || deleting;

  const isDirty = useMemo(() => {
    if (name !== config.name) return true;
    if (promptTemplate !== (config.promptTemplate ?? "")) return true;
    if (turnPromptTemplate !== (config.turnPromptTemplate ?? "")) return true;
    if (dimensions.length !== config.dimensions.length) return true;
    return dimensions.some((d, i) => {
      const orig = config.dimensions[i];
      return d.key !== orig.key || d.label !== orig.label || d.weight !== orig.weight || d.min !== orig.min || d.max !== orig.max;
    });
  }, [name, promptTemplate, turnPromptTemplate, dimensions, config]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(config.id, {
        name,
        dimensions: dimensions.map(({ _id: _, ...rest }) => rest),
        promptTemplate: promptTemplate || null,
        turnPromptTemplate: turnPromptTemplate || null,
      });
    } finally {
      setSaving(false);
    }
  }, [config.id, name, dimensions, promptTemplate, turnPromptTemplate, onSave]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(config.id);
    } finally {
      setDeleting(false);
    }
  }, [config.id, onDelete]);

  const handleActivate = useCallback(async () => {
    await onActivate(config.id);
  }, [config.id, onActivate]);

  const handleReset = useCallback(() => {
    setName(config.name);
    setDimensions(config.dimensions.map((d) => ({ ...d, _id: nanoid() })));
    setPromptTemplate(config.promptTemplate ?? "");
    setTurnPromptTemplate(config.turnPromptTemplate ?? "");
  }, [config]);

  const addDimension = useCallback(() => {
    setDimensions((prev) => [
      ...prev,
      { _id: nanoid(), key: "", label: "", weight: 0.1, min: 0, max: 10 },
    ]);
  }, []);

  const removeDimension = useCallback((id: string) => {
    setDimensions((prev) => prev.filter((d) => d._id !== id));
  }, []);

  const updateDimension = useCallback(
    (id: string, field: keyof Dimension, value: string | number) => {
      setDimensions((prev) =>
        prev.map((d) => (d._id === id ? { ...d, [field]: value } : d))
      );
    },
    []
  );

  const totalWeight = useMemo(
    () => dimensions.reduce((sum, d) => sum + (d.weight || 0), 0),
    [dimensions]
  );

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="space-y-4 p-4">
          {/* Key (read-only) */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Key</label>
            <Input className="mt-1 h-8 text-sm font-mono" value={config.key} disabled />
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input
              className="mt-1 h-8 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Dimensions */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Dimensions
              </label>
              <span className="text-xs text-muted-foreground">
                Total weight: {totalWeight.toFixed(2)}
                {Math.abs(totalWeight - 1) > 0.01 && (
                  <span className="ml-1 text-amber-500">(should be 1.0)</span>
                )}
              </span>
            </div>

            <div className="mt-2 space-y-2">
              {dimensions.map((dim) => (
                <div key={dim._id} className="flex items-center gap-2">
                  <Input
                    className="h-7 flex-1 text-xs font-mono"
                    placeholder="key"
                    value={dim.key}
                    onChange={(e) =>
                      updateDimension(dim._id, "key", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                    }
                  />
                  <Input
                    className="h-7 flex-1 text-xs"
                    placeholder="Label"
                    value={dim.label}
                    onChange={(e) => updateDimension(dim._id, "label", e.target.value)}
                  />
                  <Input
                    className="h-7 w-16 text-xs"
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    placeholder="Weight"
                    value={dim.weight}
                    onChange={(e) =>
                      updateDimension(dim._id, "weight", parseFloat(e.target.value) || 0)
                    }
                  />
                  <Input
                    className="h-7 w-14 text-xs"
                    type="number"
                    step="1"
                    placeholder="Min"
                    value={dim.min ?? 0}
                    onChange={(e) =>
                      updateDimension(dim._id, "min", parseInt(e.target.value) || 0)
                    }
                  />
                  <Input
                    className="h-7 w-14 text-xs"
                    type="number"
                    step="1"
                    placeholder="Max"
                    value={dim.max ?? 10}
                    onChange={(e) =>
                      updateDimension(dim._id, "max", parseInt(e.target.value) || 0)
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeDimension(dim._id)}
                  >
                    <XIcon className="size-3" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={addDimension}
              data-testid="btn-add-dimension"
            >
              <PlusIcon className="mr-1 size-3" />
              Add Dimension
            </Button>
          </div>

          {/* Prompt Template */}
          <div>
            <div className="flex items-center gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Prompt Template
              </label>
              <GuideDialog title="Prompt Template" content={promptTemplateGuide} />
              {promptTemplate !== DEFAULT_PROMPT_TEMPLATE && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setPromptTemplate(DEFAULT_PROMPT_TEMPLATE)}
                  title="Restore default"
                >
                  <UndoIcon className="size-3" />
                </Button>
              )}
            </div>
            <MdEditor
              value={promptTemplate}
              onChange={setPromptTemplate}
              variables={["mode", "user_input", "expected_output", "actual_response", "conversation"]}
              height="160px"
              className="mt-1"
            />
          </div>

          {/* Turn Prompt Template */}
          <div>
            <div className="flex items-center gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Turn Prompt Template
              </label>
              <GuideDialog title="Turn Prompt Template" content={turnPromptTemplateGuide} />
              {turnPromptTemplate !== DEFAULT_TURN_PROMPT_TEMPLATE && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setTurnPromptTemplate(DEFAULT_TURN_PROMPT_TEMPLATE)}
                  title="Restore default"
                >
                  <UndoIcon className="size-3" />
                </Button>
              )}
            </div>
            <MdEditor
              value={turnPromptTemplate}
              onChange={setTurnPromptTemplate}
              variables={["mode", "user_input", "expected_output", "actual_response", "conversation"]}
              height="120px"
              className="mt-1"
            />
          </div>
        </div>
      </ScrollArea>

      {/* Bottom action bar */}
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
        <Button size="sm" onClick={handleSave} disabled={busy || !isDirty} data-testid="btn-save">
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
          disabled={busy || !isDirty}
        >
          <RotateCcwIcon className="mr-1 size-3" />
          Reset
        </Button>
        <div className="flex-1" />
        <Button
          variant="destructive"
          size="sm"
          disabled={busy || config.isActive}
          onClick={() => setConfirmOpen(true)}
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
        description="This judge config will be moved to trash."
        onConfirm={handleDelete}
      />
    </div>
  );
}
