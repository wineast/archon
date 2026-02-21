"use client";

import { useEffect, useImperativeHandle, useRef, useCallback } from "react";
import { useForm, useFieldArray, useWatch, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusIcon, XIcon } from "lucide-react";
import equal from "fast-deep-equal";

interface McpServerFormValues {
  name: string;
  description: string;
  url: string;
  transportType: "sse" | "http";
  headers: { key: string; value: string }[];
}

export interface McpServerFormHandle {
  getDraft: () => {
    name: string;
    description: string;
    url: string;
    transportType: "sse" | "http";
    headers: Record<string, string>;
  };
  reset: () => void;
}

interface McpServerFormProps {
  serverKey: string;
  name: string;
  description: string;
  url: string;
  transportType: "sse" | "http";
  headers: Record<string, string>;
  onDraftRef: (handle: McpServerFormHandle | null) => void;
  onDirtyChange: (dirty: boolean) => void;
}

function headersToArray(headers: Record<string, string>): { key: string; value: string }[] {
  const entries = Object.entries(headers);
  return entries.length > 0 ? entries.map(([key, value]) => ({ key, value })) : [];
}

function arrayToHeaders(arr: { key: string; value: string }[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { key, value } of arr) {
    if (key.trim()) result[key.trim()] = value;
  }
  return result;
}

export function McpServerForm({
  serverKey,
  name,
  description,
  url,
  transportType,
  headers,
  onDraftRef,
  onDirtyChange,
}: McpServerFormProps) {
  const originalRef = useRef({
    name,
    description,
    url,
    transportType,
    headers: headersToArray(headers),
  });

  const form = useForm<McpServerFormValues>({
    defaultValues: originalRef.current,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "headers",
  });

  const watched = useWatch({ control: form.control });

  useEffect(() => {
    const dirty = !equal(watched, originalRef.current);
    onDirtyChange(dirty);
  }, [watched, onDirtyChange]);

  const getDraft = useCallback(() => {
    const v = form.getValues();
    return {
      name: v.name,
      description: v.description,
      url: v.url,
      transportType: v.transportType,
      headers: arrayToHeaders(v.headers),
    };
  }, [form]);

  const reset = useCallback(() => {
    form.reset(originalRef.current);
  }, [form]);

  useImperativeHandle(
    { current: null },
    () => null,
    []
  );

  useEffect(() => {
    onDraftRef({ getDraft, reset });
    return () => onDraftRef(null);
  }, [getDraft, reset, onDraftRef]);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Key</label>
        <Input className="mt-1 h-8 text-sm font-mono" value={serverKey} readOnly />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Name</label>
        <Input className="mt-1 h-8 text-sm" {...form.register("name")} />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <Textarea className="mt-1 text-sm" rows={2} {...form.register("description")} />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">URL</label>
        <Input
          className="mt-1 h-8 text-sm font-mono"
          placeholder="https://example.com/mcp"
          {...form.register("url")}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Transport Type</label>
        <Controller
          control={form.control}
          name="transportType"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="mt-1 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sse">SSE (Server-Sent Events)</SelectItem>
                <SelectItem value="http">HTTP (Streamable HTTP)</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Headers</label>
        <div className="mt-1 space-y-1.5">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-1.5">
              <Input
                className="h-7 text-xs font-mono flex-1"
                placeholder="Header name"
                {...form.register(`headers.${index}.key`)}
              />
              <Input
                className="h-7 text-xs font-mono flex-1"
                placeholder="Header value"
                {...form.register(`headers.${index}.value`)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => remove(index)}
              >
                <XIcon className="size-3" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => append({ key: "", value: "" })}
          >
            <PlusIcon className="mr-1 size-3" />
            Add Header
          </Button>
        </div>
      </div>

    </div>
  );
}
