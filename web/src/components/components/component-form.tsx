"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JsEditor } from "@/components/editors/js-editor";
import { ComponentPreviewPanel } from "@/components/tools/component-preview-panel";
import type { ComponentDefinition } from "@/lib/components/types";
import { useEffect, useRef } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";

export interface ComponentFormHandle {
  getDraft: () => ComponentDefinition;
  isDirty: () => boolean;
  reset: () => void;
}

interface ComponentFormProps {
  component: ComponentDefinition;
  onDraftRef: (ref: ComponentFormHandle) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

/** Bridge: isolates component watching from the main form. */
function PreviewBridge() {
  const { control, setValue } = useFormContext<ComponentDefinition>();
  const componentSource = useWatch({ control, name: "componentSource" });
  const componentMockData = useWatch({ control, name: "componentMockData" });
  return (
    <ComponentPreviewPanel
      componentSource={componentSource}
      mockData={componentMockData}
      onMockDataChange={(value) => setValue("componentMockData", value)}
      collapsible={false}
    />
  );
}

export function ComponentForm({ component, onDraftRef, onDirtyChange }: ComponentFormProps) {
  const form = useForm<ComponentDefinition>({ defaultValues: { ...component } });
  const originalRef = useRef(JSON.stringify(component));

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
            完整函数组件: function Component({"{ output, isLoading, ... }"}) {"{ ... }"}
          </p>
          <p className="text-xs text-muted-foreground">
            Props: toolName, state, input, output, isLoading, isComplete, isError
          </p>
        </div>
        <PreviewBridge />
      </div>
    </FormProvider>
  );
}
