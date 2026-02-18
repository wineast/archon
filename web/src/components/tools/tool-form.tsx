"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JsEditor } from "@/components/ui/editors/js-editor";
import { JsonEditor } from "@/components/ui/editors/json-editor";
import type { ToolDefinition } from "@/lib/tools/types";
import { useDatasets } from "@/lib/datasets/hooks";
import type { EnumRefOption } from "@/components/parameters/parameter-row";
import { ParameterList } from "@/components/parameters/parameter-list";
import { ReturnParameterList } from "@/components/parameters/return-parameter-list";
import { HandlerTestPanel } from "./handler-test-panel";
import { ComponentPreviewPanel } from "./component-preview-panel";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { CodeIcon, GlobeIcon, LinkIcon, TypeIcon } from "lucide-react";

export interface ToolFormHandle {
  getDraft: () => ToolDefinition;
  isDirty: () => boolean;
  reset: () => void;
}

interface ToolFormProps {
  tool: ToolDefinition;
  agentId?: string;
  onDraftRef: (ref: ToolFormHandle) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const VALID_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

type HandlerMode = "simple" | "code";

function detectHandlerMode(handler: string): HandlerMode {
  const h = handler.trim();
  if (h.includes("=>") || h.includes("function")) return "code";
  return "simple";
}

/** Bridge: isolates parameter/handler watching from the main form. */
function HandlerTestPanelBridge() {
  const { control } = useFormContext<ToolDefinition>();
  const handler = useWatch({ control, name: "handler" });
  const parameters = useWatch({ control, name: "parameters" });
  return <HandlerTestPanel handler={handler} parameters={parameters} />;
}

/** Bridge: isolates component watching from the main form. */
function ComponentPreviewPanelBridge() {
  const { control, setValue } = useFormContext<ToolDefinition>();
  const componentSource = useWatch({ control, name: "componentSource" });
  const componentMockData = useWatch({ control, name: "componentMockData" });
  return (
    <ComponentPreviewPanel
      componentSource={componentSource}
      mockData={componentMockData}
      onMockDataChange={(value) => setValue("componentMockData", value)}
    />
  );
}

export function ToolForm({ tool, agentId, onDraftRef, onDirtyChange }: ToolFormProps) {
  const form = useForm<ToolDefinition>({ defaultValues: { ...tool } });
  const [handlerMode, setHandlerMode] = useState<HandlerMode>(() =>
    detectHandlerMode(tool.handler)
  );
  const originalRef = useRef(JSON.stringify(tool));

  // Watch only fields needed for validation / conditional rendering
  const name = useWatch({ control: form.control, name: "name" });
  const handler = useWatch({ control: form.control, name: "handler" });
  const output = useWatch({ control: form.control, name: "output" });

  // Fetch datasets for enum ref options
  const { datasets } = useDatasets(agentId);

  const enumRefOptions = useMemo<EnumRefOption[]>(() => {
    return datasets
      .filter((d) => typeof d.data === "object" && d.data !== null)
      .map((d) => ({ key: d.key, source: "dataset" as const }));
  }, [datasets]);

  const enumRefValues = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    for (const d of datasets) {
      if (Array.isArray(d.data)) {
        map[d.key] = (d.data as unknown[]).map(String);
      } else if (typeof d.data === "object" && d.data !== null) {
        const vals = Object.values(d.data as Record<string, unknown>);
        if (vals.every((v) => typeof v === "string")) {
          map[d.key] = vals as string[];
        } else {
          map[d.key] = Object.keys(d.data as Record<string, unknown>);
        }
      }
    }
    return map;
  }, [datasets]);

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

  const nameError = useMemo(() => {
    if (!name?.trim()) return "Name is required";
    if (!VALID_NAME_RE.test(name))
      return "Must start with a letter/underscore and contain only letters, digits, underscores";
    return null;
  }, [name]);

  const hasHandler = !!handler?.trim();

  const handlerHint = useMemo(() => {
    const h = handler?.trim();
    if (!h) return null;
    if (h.startsWith("http://") || h.startsWith("https://")) return "remote";
    return "local";
  }, [handler]);

  const outputHint = useMemo(() => {
    if (!output?.trim()) return null;
    try {
      JSON.parse(output);
      return null;
    } catch {
      return "Invalid JSON \u2014 will be returned as { result: string }";
    }
  }, [output]);

  return (
    <FormProvider {...form}>
      <div className="space-y-3 min-w-0">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Tool Name
          </label>
          <Input
            className="mt-1 h-8 text-sm"
            {...form.register("name")}
            placeholder="e.g. searchProducts"
          />
          {nameError && (
            <p className="text-xs text-destructive mt-1">{nameError}</p>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Description
          </label>
          <Textarea
            className="mt-1 min-h-[60px] resize-none text-sm"
            {...form.register("description")}
            placeholder="Describe what this tool does and when the AI should use it..."
          />
        </div>
        <ParameterList
          fieldName="parameters"
          label="Parameters"
          enumRefOptions={enumRefOptions}
          enumRefValues={enumRefValues}
        />
        <div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Handler
            </label>
            <div className="flex items-center rounded-md border border-border p-0.5">
              <button
                type="button"
                onClick={() => setHandlerMode("simple")}
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
                  handlerMode === "simple"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TypeIcon className="size-3" />
                简单
              </button>
              <button
                type="button"
                onClick={() => setHandlerMode("code")}
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
                  handlerMode === "code"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CodeIcon className="size-3" />
                代码
              </button>
            </div>
          </div>

          {handlerMode === "simple" ? (
            <>
              <Input
                className="mt-1 h-8 text-sm font-mono"
                {...form.register("handler")}
                placeholder="留空使用静态输出，或填写本地 key / URL"
              />
              {handlerHint === "remote" && (
                <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                  <GlobeIcon className="size-3" />
                  远程 API — 调用时将 POST 参数到此 URL
                </p>
              )}
              {handlerHint === "local" && (
                <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                  <LinkIcon className="size-3" />
                  本地实现 — 关联代码中注册的 handler
                </p>
              )}
            </>
          ) : (
            <>
              <Controller
                name="handler"
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
              <p className="text-xs text-purple-500 mt-1">
                JS 代码 — 运行时动态执行
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                可用 context API：wiki.get(id) → {"{meta, content}"},
                wiki.findByPrefix(prefix), wiki.search(query)
              </p>
              <HandlerTestPanelBridge />
            </>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Output (JSON)
          </label>
          <Controller
            name="output"
            control={form.control}
            render={({ field }) => (
              <JsonEditor
                value={field.value}
                onChange={field.onChange}
                height="150px"
                readOnly={hasHandler}
                className="mt-1"
              />
            )}
          />
          {hasHandler && (
            <p className="text-xs text-muted-foreground mt-1">
              Handler 已接管，此字段不生效
            </p>
          )}
          {!hasHandler && outputHint && (
            <p className="text-xs text-amber-500 mt-1">{outputHint}</p>
          )}
          {!hasHandler && !outputHint && (
            <p className="text-xs text-muted-foreground mt-1">
              支持 Liquid 模板语法：{"{{变量名}}"}、{"{{码表key}}"}、{"{% include 'doc' %}"}
            </p>
          )}
        </div>
        <ReturnParameterList
          fieldName="returnParameters"
          label="Return Parameters"
        />
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            UI Component (JSX)
          </label>
          <Controller
            name="componentSource"
            control={form.control}
            render={({ field }) => (
              <JsEditor
                value={field.value}
                onChange={field.onChange}
                height="200px"
                className="mt-1"
              />
            )}
          />
          <p className="text-xs text-muted-foreground mt-1">
            完整函数组件: function Component({"{ output, isLoading, ... }"}) {"{ ... }"}
          </p>
          <p className="text-xs text-muted-foreground">
            简单 JSX 片段也可用，props: toolName, state, input, output, isLoading, isComplete, isError
          </p>
          <p className="text-xs text-muted-foreground">
            可用: useState, useMemo, useCallback, useEffect, useRef, Fragment, Table 系列, Badge, Spinner, Tooltip 系列, CollapsibleSection, ResultHeader, ResultSection, RateSheetLinks, RateSheetPanel, ChevronRight, FileText
          </p>
          <ComponentPreviewPanelBridge />
        </div>
      </div>
    </FormProvider>
  );
}
