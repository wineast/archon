"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JsEditor } from "@/components/editors/js-editor";
import type { ToolDefinition } from "@/lib/tools/types";
import { useDatasets } from "@/lib/datasets/hooks";
import { useComponents } from "@/lib/components/hooks";
import { useSchemas } from "@/lib/schemas/hooks";
import type { EnumRefOption } from "@/components/parameters/parameter-row";
import { ParameterList } from "@/components/parameters/parameter-list";
import { ReturnParameterList } from "@/components/parameters/return-parameter-list";
import { SchemaParameterPreview } from "@/components/schemas/schema-parameter-preview";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  useWatch,
} from "react-hook-form";
import { BracesIcon, CodeIcon, GlobeIcon, ListIcon, TypeIcon } from "lucide-react";

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

type ParamMode = "inline" | "ref";

interface ParameterSectionProps {
  label: string;
  fieldName: "parameters" | "returnParameters";
  schemaRefFieldName: "parametersSchemaRef" | "returnParametersSchemaRef";
  schemaRefValue: string | null | undefined;
  schemas: { key: string; name: string; parameters: import("@/lib/tools/types").ToolParameter[] }[];
  form: ReturnType<typeof useForm<ToolDefinition>>;
  enumRefOptions?: EnumRefOption[];
  enumRefValues?: Record<string, string[]>;
}

function ParameterSection({
  label,
  fieldName,
  schemaRefFieldName,
  schemaRefValue,
  schemas,
  form,
  enumRefOptions,
  enumRefValues,
}: ParameterSectionProps) {
  const mode: ParamMode = schemaRefValue ? "ref" : "inline";
  const selectedSchema = schemas.find((s) => s.key === schemaRefValue);

  const setMode = (next: ParamMode) => {
    if (next === "inline") {
      form.setValue(schemaRefFieldName, null, { shouldDirty: true });
    } else {
      // Switch to ref: pick first schema if available
      const first = schemas[0]?.key ?? null;
      form.setValue(schemaRefFieldName, first, { shouldDirty: true });
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        {schemas.length > 0 && (
          <div className="flex items-center rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setMode("inline")}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
                mode === "inline"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListIcon className="size-3" />
              内联
            </button>
            <button
              type="button"
              onClick={() => setMode("ref")}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
                mode === "ref"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BracesIcon className="size-3" />
              引用
            </button>
          </div>
        )}
      </div>

      {mode === "inline" ? (
        fieldName === "returnParameters" ? (
          <ReturnParameterList fieldName={fieldName} label="" />
        ) : (
          <ParameterList
            fieldName={fieldName}
            label=""
            enumRefOptions={enumRefOptions}
            enumRefValues={enumRefValues}
          />
        )
      ) : (
        <div className="mt-1 space-y-2">
          <Controller
            name={schemaRefFieldName}
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={field.onChange}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select a schema..." />
                </SelectTrigger>
                <SelectContent>
                  {schemas.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.name} ({s.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {selectedSchema && (
            <SchemaParameterPreview parameters={selectedSchema.parameters} />
          )}
        </div>
      )}
    </div>
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
  const parametersSchemaRef = useWatch({ control: form.control, name: "parametersSchemaRef" });
  const returnParametersSchemaRef = useWatch({ control: form.control, name: "returnParametersSchemaRef" });

  // Fetch schemas for ref mode
  const { schemas } = useSchemas(agentId);

  // Fetch datasets for enum ref options
  const { datasets } = useDatasets(agentId);

  // Fetch components for component selector
  const { components: componentsList } = useComponents(agentId);
  const componentOptions = useMemo(
    () => componentsList.map((c) => ({ key: c.key, name: c.name })),
    [componentsList]
  );

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

  const handlerHint = useMemo(() => {
    const h = handler?.trim();
    if (!h) return null;
    if (h.startsWith("http://") || h.startsWith("https://")) return "remote";
    return null;
  }, [handler]);

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
        <ParameterSection
          label="Parameters"
          fieldName="parameters"
          schemaRefFieldName="parametersSchemaRef"
          schemaRefValue={parametersSchemaRef}
          schemas={schemas}
          form={form}
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
                placeholder="填写 URL"
              />
              {handlerHint === "remote" && (
                <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                  <GlobeIcon className="size-3" />
                  远程 API — 调用时将 POST 参数到此 URL
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
            </>
          )}
        </div>
        <ParameterSection
          label="Return Parameters"
          fieldName="returnParameters"
          schemaRefFieldName="returnParametersSchemaRef"
          schemaRefValue={returnParametersSchemaRef}
          schemas={schemas}
          form={form}
        />
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            UI Component
          </label>
          <Controller
            name="component"
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value || "__none__"}
                onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue placeholder="Select a component..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {componentOptions.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.name} ({c.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground mt-1">
            关联 Components 页面中定义的组件，用于展示工具结果
          </p>
        </div>
      </div>
    </FormProvider>
  );
}
