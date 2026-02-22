"use client";

import { useCallback, useMemo, useState } from "react";
import { nanoid } from "nanoid";
import {
  CheckIcon,
  PowerIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import type { JudgeConfigRow } from "@/db/schema";
import type { Dimension } from "@/lib/eval/types";

interface JudgeConfigDetailProps {
  config: JudgeConfigRow;
  onSave: (id: string, data: { name: string; dimensions: Dimension[] }) => Promise<void>;
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

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isDirty = useMemo(() => {
    if (name !== config.name) return true;
    if (dimensions.length !== config.dimensions.length) return true;
    return dimensions.some((d, i) => {
      const orig = config.dimensions[i];
      return d.key !== orig.key || d.label !== orig.label || d.weight !== orig.weight;
    });
  }, [name, dimensions, config]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(config.id, {
        name,
        dimensions: dimensions.map(({ _id: _, ...rest }) => rest),
      });
    } finally {
      setSaving(false);
    }
  }, [config.id, name, dimensions, onSave]);

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
  }, [config]);

  const addDimension = useCallback(() => {
    setDimensions((prev) => [
      ...prev,
      { _id: nanoid(), key: "", label: "", weight: 0.1 },
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
            >
              <PlusIcon className="mr-1 size-3" />
              Add Dimension
            </Button>
          </div>
        </div>
      </ScrollArea>

      {/* Bottom action bar */}
      <div className="flex items-center gap-2 border-t px-4 py-2">
        {!config.isActive && (
          <Button variant="outline" size="sm" onClick={handleActivate}>
            <PowerIcon className="mr-1.5 size-3.5" />
            Activate
          </Button>
        )}
        {config.isActive && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckIcon className="size-3" />
            Active
          </span>
        )}

        <Button size="sm" onClick={handleSave} disabled={saving || !isDirty}>
          {saving ? <Spinner className="mr-1.5 size-3" /> : <SaveIcon className="mr-1.5 size-3.5" />}
          {saving ? "Saving..." : "Save"}
        </Button>

        <Button variant="ghost" size="sm" onClick={handleReset} disabled={!isDirty}>
          <RotateCcwIcon className="mr-1.5 size-3.5" />
        </Button>

        <div className="flex-1" />

        <Button
          variant="destructive"
          size="sm"
          disabled={deleting || config.isActive}
          onClick={() => setConfirmOpen(true)}
        >
          {deleting ? <Spinner className="mr-1.5 size-3" /> : <Trash2Icon className="mr-1.5 size-3.5" />}
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
