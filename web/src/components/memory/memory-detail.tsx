"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import equal from "fast-deep-equal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MemoryRow } from "@/db/schema";

interface FormValues {
  type: string;
  content: string;
  importance: number;
  expiresAt: string;
}

function toFormValues(memory: MemoryRow): FormValues {
  return {
    type: memory.type,
    content: memory.content,
    importance: memory.importance ?? 0.5,
    expiresAt: memory.expiresAt
      ? new Date(memory.expiresAt).toISOString().slice(0, 10)
      : "",
  };
}

interface MemoryDetailProps {
  memory: MemoryRow;
  allTypes: string[];
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (memory: MemoryRow) => void;
}

export function MemoryDetail({
  memory,
  allTypes,
  onSave,
  onDelete,
}: MemoryDetailProps) {
  const [saving, setSaving] = useState(false);
  const originalRef = useRef(toFormValues(memory));

  const form = useForm<FormValues>({
    defaultValues: originalRef.current,
  });

  const [dirty, setDirty] = useState(false);

  // Reset form when memory changes
  useEffect(() => {
    const next = toFormValues(memory);
    originalRef.current = next;
    form.reset(next);
    setDirty(false);
  }, [memory.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sub = form.watch(() => {
      setDirty(!equal(form.getValues(), originalRef.current));
    });
    return () => sub.unsubscribe();
  }, [form]);

  const handleSave = useCallback(async () => {
    const values = form.getValues();
    setSaving(true);
    try {
      await onSave(memory.id, {
        type: values.type,
        content: values.content,
        importance: values.importance,
        expiresAt: values.expiresAt || null,
      });
      originalRef.current = values;
      form.reset(values);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [memory.id, form, onSave]);

  const handleReset = useCallback(() => {
    form.reset(originalRef.current);
    setDirty(false);
  }, [form]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-4">
          {/* Type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Type
            </label>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Content */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Content
            </label>
            <Textarea
              className="mt-1 text-sm"
              {...form.register("content")}
              placeholder="Memory content..."
              rows={4}
            />
          </div>

          {/* Importance */}
          <div>
            <Controller
              control={form.control}
              name="importance"
              render={({ field }) => (
                <>
                  <label className="text-xs font-medium text-muted-foreground">
                    Importance: {((field.value ?? 0.5) * 100).toFixed(0)}%
                  </label>
                  <Slider
                    className="mt-2"
                    value={[field.value]}
                    onValueChange={([v]) => field.onChange(v)}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </>
              )}
            />
          </div>

          {/* User ID (read-only) */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              User ID
            </label>
            <p className="mt-1 text-sm">{memory.userId || "-"}</p>
          </div>

          {/* Expires At */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Expires At
            </label>
            <Input
              className="mt-1 h-8 text-sm"
              type="date"
              {...form.register("expiresAt")}
            />
          </div>
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
        <div className="flex-1" />
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(memory)}
          disabled={saving}
        >
          <Trash2Icon className="mr-1 size-3" />
          Delete
        </Button>
      </div>
    </div>
  );
}
