"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JsEditor } from "@/components/editors/js-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSchemas } from "@/lib/schemas/hooks";
import type { ComponentDefinition } from "@/lib/components/types";
import { useEffect, useRef } from "react";
import {
  Controller,
  FormProvider,
  useForm,
} from "react-hook-form";

export interface ComponentFormHandle {
  getDraft: () => ComponentDefinition;
  isDirty: () => boolean;
  reset: () => void;
}

interface ComponentFormProps {
  component: ComponentDefinition;
  agentId?: string;
  onDraftRef: (ref: ComponentFormHandle) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function ComponentForm({ component, agentId, onDraftRef, onDirtyChange }: ComponentFormProps) {
  const form = useForm<ComponentDefinition>({ defaultValues: { ...component } });
  const originalRef = useRef(JSON.stringify(component));
  const { schemas } = useSchemas(agentId);

  useEffect(() => {
    onDraftRef({
      getDraft: () => form.getValues(),
      isDirty: () => JSON.stringify(form.getValues()) !== originalRef.current,
      reset: () => {
        const original = JSON.parse(originalRef.current);
        form.reset(original);
      },
    });
  }, [onDraftRef, form]);

  useEffect(() => {
    let wasDirty = false;
    const subscription = form.watch(() => {
      const isDirty =
        JSON.stringify(form.getValues()) !== originalRef.current;
      if (isDirty !== wasDirty) {
        wasDirty = isDirty;
        onDirtyChange?.(isDirty);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, onDirtyChange]);

  return (
    <FormProvider {...form}>
      <div className="space-y-3 min-w-0">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Key
          </label>
          <Input
            className="mt-1 h-8 text-sm font-mono bg-muted"
            {...form.register("key")}
            readOnly
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Name
          </label>
          <Input
            className="mt-1 h-8 text-sm"
            {...form.register("name")}
            placeholder="e.g. Product Card"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Description
          </label>
          <Textarea
            className="mt-1 min-h-[60px] resize-none text-sm"
            {...form.register("description")}
            placeholder="Describe what this component renders..."
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Input Schema Ref
          </label>
          <Controller
            name="inputSchemaRef"
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value ?? "__none__"}
                onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
              >
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue placeholder="Select a schema..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {schemas.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Output Schema Ref
          </label>
          <Controller
            name="outputSchemaRef"
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value ?? "__none__"}
                onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
              >
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue placeholder="Select a schema..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {schemas.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Component Source (JSX)
          </label>
          <Controller
            name="componentSource"
            control={form.control}
            render={({ field }) => (
              <JsEditor
                value={field.value}
                onChange={field.onChange}
                height="300px"
                className="mt-1"
              />
            )}
          />
          <p className="text-xs text-muted-foreground mt-1">
            完整函数组件: function Component({"{ tool, state, isLoading, ... }"}) {"{ ... }"}
          </p>
          <p className="text-xs text-muted-foreground">
            Props: tool (name/input/output), state, isLoading, isComplete, isError
          </p>
        </div>
      </div>
    </FormProvider>
  );
}
