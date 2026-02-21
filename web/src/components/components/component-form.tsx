"use client";

import { Input } from "@/components/ui/input";
import { KeyField } from "@/components/ui/key-field";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { JsEditor } from "@/components/editors/js-editor";
import { InlineSchemaEditor } from "@/components/schemas/inline-schema-editor";
import { inferComponentDeps, keyToPascal, type ComponentRecord } from "@/tool-ui";
import type { ComponentDefinition } from "@/lib/components/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { BoxIcon, SparklesIcon, WrenchIcon } from "lucide-react";
import {
  Controller,
  FormProvider,
  useForm,
  useWatch,
} from "react-hook-form";
import deepEqual from "fast-deep-equal";
import { Button } from "@/components/ui/button";
import { ComponentHelpButton } from "./component-help-dialog";
import { JsxAssistDialog } from "./jsx-assist-dialog";

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

const TOOL_SCHEMA_TEMPLATE = {
  type: "object",
  properties: {
    name: { type: "string", description: "工具名称" },
    input: { type: "object", properties: {}, description: "工具输入参数" },
    output: { type: "object", properties: {}, description: "工具输出结果" },
  },
  required: ["name", "input", "output"],
};

const COMPONENT_SCHEMA_TEMPLATE = {
  type: "object",
  properties: {},
  required: [],
};

export function ComponentForm({ component, agentId, allComponents, onDraftRef, onDirtyChange }: ComponentFormProps) {
  const form = useForm<ComponentDefinition>({ defaultValues: { ...component } });
  const originalRef = useRef<ComponentDefinition>({ ...component });
  const currentSource = form.watch("componentSource");
  const [jsxAssistOpen, setJsxAssistOpen] = useState(false);

  const scenario = useWatch({ control: form.control, name: "scenario" });

  // Infer referenced components from JSX source
  const referencedComponents = useMemo(() => {
    if (!allComponents?.length || !currentSource) return [];
    const knownKeys = new Set(allComponents.map((c) => c.key));
    return inferComponentDeps(currentSource, knownKeys);
  }, [allComponents, currentSource]);

  useEffect(() => {
    onDraftRef({
      getDraft: () => form.getValues(),
      isDirty: () => !deepEqual(form.getValues(), originalRef.current),
      reset: () => {
        form.reset({ ...originalRef.current });
      },
    });
  }, [onDraftRef, form]);

  useEffect(() => {
    let wasDirty = false;
    const subscription = form.watch(() => {
      const isDirty = !deepEqual(form.getValues(), originalRef.current);
      if (isDirty !== wasDirty) {
        wasDirty = isDirty;
        onDirtyChange?.(isDirty);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, onDirtyChange]);

  const handleScenarioChange = (newScenario: "tool" | "component") => {
    form.setValue("scenario", newScenario, { shouldDirty: true });
    const template = newScenario === "tool" ? TOOL_SCHEMA_TEMPLATE : COMPONENT_SCHEMA_TEMPLATE;
    form.setValue("inputSchema", template, { shouldDirty: true });
  };

  return (
    <FormProvider {...form}>
      <div className="space-y-3 min-w-0">
        <KeyField value={form.getValues("key")} />
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
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              场景
            </label>
            <div className="flex items-center rounded-md border border-border p-0.5">
              <button
                type="button"
                onClick={() => handleScenarioChange("tool")}
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
                  scenario === "tool"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <WrenchIcon className="size-3" />
                工具
              </button>
              <button
                type="button"
                onClick={() => handleScenarioChange("component")}
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
                  scenario === "component"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BoxIcon className="size-3" />
                组件
              </button>
            </div>
          </div>
        </div>
        <Controller
          name="inputSchema"
          control={form.control}
          render={({ field }) => (
            <InlineSchemaEditor
              label="Data (JSON / Template)"
              value={field.value ?? null}
              onChange={field.onChange}
            />
          )}
        />
        <div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Component Source (JSX)
            </label>
            <ComponentHelpButton />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-xs"
              onClick={() => setJsxAssistOpen(true)}
            >
              <SparklesIcon className="size-3" />
              AI 编辑
            </Button>
          </div>
          <JsxAssistDialog
            open={jsxAssistOpen}
            onOpenChange={setJsxAssistOpen}
            jsxSource={currentSource}
            onApply={(src) => form.setValue("componentSource", src, { shouldDirty: true })}
            agentId={agentId}
          />
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
