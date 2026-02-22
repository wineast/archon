"use client";

import { useCallback, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import equal from "fast-deep-equal";
import { RotateCcwIcon, SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useModels } from "@/lib/models/hooks";
import type { RagConfigRow } from "@/db/schema";

interface RagConfigDetailProps {
  config: RagConfigRow | null;
  isLoading?: boolean;
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
}

interface FormValues {
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
}

export function RagConfigDetail({ config, isLoading, onSave }: RagConfigDetailProps) {
  const { models } = useModels();
  const embeddingModels = models.filter((m) => m.type === "embedding");

  const originalRef = useRef<FormValues | null>(null);

  const form = useForm<FormValues>({
    defaultValues: {
      embeddingModel: "openai/text-embedding-3-small",
      chunkSize: 500,
      chunkOverlap: 50,
      topK: 5,
    },
  });

  useEffect(() => {
    if (config) {
      const values: FormValues = {
        embeddingModel: config.embeddingModel,
        chunkSize: config.chunkSize,
        chunkOverlap: config.chunkOverlap,
        topK: config.topK,
      };
      originalRef.current = values;
      form.reset(values);
    }
  }, [config, form]);

  const isDirty = !equal(originalRef.current, form.watch());

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      if (!config) return;
      await onSave(config.id, values as unknown as Record<string, unknown>);
      originalRef.current = values;
    },
    [config, onSave]
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No config found
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="flex h-full flex-col"
    >
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 p-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Embedding 模型
            </label>
            <Controller
              name="embeddingModel"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {embeddingModels.map((m) => (
                      <SelectItem key={m.modelId} value={m.modelId}>
                        {m.name} ({m.provider})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              分块大小（字符数）
            </label>
            <Input
              type="number"
              className="mt-1"
              {...form.register("chunkSize", { valueAsNumber: true })}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              重叠量（字符数）
            </label>
            <Input
              type="number"
              className="mt-1"
              {...form.register("chunkOverlap", { valueAsNumber: true })}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              默认返回数量 (Top K)
            </label>
            <Input
              type="number"
              className="mt-1"
              {...form.register("topK", { valueAsNumber: true })}
            />
          </div>
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button
          type="submit"
          size="sm"
          disabled={!isDirty || form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <Spinner className="mr-1.5 size-4" />
          ) : (
            <SaveIcon className="mr-1.5 size-4" />
          )}
          {form.formState.isSubmitting ? "Saving..." : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!isDirty}
          onClick={() => {
            if (originalRef.current) form.reset(originalRef.current);
          }}
        >
          <RotateCcwIcon className="mr-1.5 size-4" />
          Reset
        </Button>
      </div>
    </form>
  );
}
