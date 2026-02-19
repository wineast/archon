"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { JsEditor } from "@/components/editors/js-editor";
import { inferComponentDeps, keyToPascal, type ComponentRecord } from "@/tool-ui";
import type { ComponentDefinition } from "@/lib/components/types";
import { useEffect, useMemo, useRef } from "react";
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
  allComponents?: ComponentRecord[];
  onDraftRef: (ref: ComponentFormHandle) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function ComponentForm({ component, agentId, allComponents, onDraftRef, onDirtyChange }: ComponentFormProps) {
  const form = useForm<ComponentDefinition>({ defaultValues: { ...component } });
  const originalRef = useRef(JSON.stringify(component));
  const currentSource = form.watch("componentSource");

  // Infer referenced components from JSX source
  const referencedComponents = useMemo(() => {
    if (!allComponents?.length || !currentSource) return [];
    const knownKeys = new Set(allComponents.map((c) => c.key));
    return inferComponentDeps(currentSource, knownKeys);
  }, [allComponents, currentSource]);

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
            两层闭包: function Component({"{ React, useState, DepA }"}) {"{"} return function({"{ tool, state, ... }"}) {"{ ... }"} {"}"}
          </p>
          <p className="text-xs text-muted-foreground">
            外层参数: 解构声明所需依赖（React/hooks/UI 组件/自定义组件）；内层 props: tool, state, isLoading, isComplete, isError
          </p>
          {referencedComponents.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground">引用组件:</span>
              {referencedComponents.map((key) => (
                <Badge key={key} variant="secondary" className="text-xs font-mono">
                  {keyToPascal(key)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </FormProvider>
  );
}
