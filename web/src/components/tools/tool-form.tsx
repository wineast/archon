"use client";

import { Input } from "@/components/ui/input";
import { KeyField } from "@/components/ui/key-field";
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
import { useComponents } from "@/lib/components/hooks";
import { InlineSchemaEditor } from "@/components/schemas/inline-schema-editor";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  useWatch,
} from "react-hook-form";
import deepEqual from "fast-deep-equal";
import { CodeIcon, GlobeIcon, MonitorIcon, ServerIcon, SparklesIcon, EyeOffIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { GuideDialog } from "@/components/ui/guide-dialog";
import { useAgentOrgId } from "@/lib/agents/hooks";
import { ToolCodeAssistDialog } from "./tool-code-assist-dialog";
import { Button } from "@/components/ui/button";
import toolHandlerDoc from "../../../guide/tool-handler.md";

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
  /** When true, all fields are disabled/readOnly. */
  readOnly?: boolean;
  /** When true, hide handler editor and execution target selector (for builtin resources). */
  hideBuiltinSections?: boolean;
}

const VALID_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

type HandlerTab = "url" | "code";

function detectHandlerTab(tool: ToolDefinition): HandlerTab {
  if (tool.url?.trim()) return "url";
  return "code";
}

export function ToolForm({ tool, agentId, onDraftRef, onDirtyChange, readOnly, hideBuiltinSections }: ToolFormProps) {
  const form = useForm<ToolDefinition>({ defaultValues: { ...tool } });
  const [handlerTab, setHandlerTab] = useState<HandlerTab>(() =>
    detectHandlerTab(tool)
  );
  const [codeAssistOpen, setCodeAssistOpen] = useState(false);
  const orgId = useAgentOrgId(agentId);
  const originalRef = useRef<ToolDefinition>({ ...tool });

  // Watch only fields needed for validation / conditional rendering
  const name = useWatch({ control: form.control, name: "name" });
  const executionTarget = useWatch({ control: form.control, name: "executionTarget" });

  // Fetch components for component selector
  const { components: componentsList } = useComponents(agentId);
  const componentOptions = useMemo(
    () => componentsList.map((c) => ({ id: c.id, key: c.key, name: c.name })),
    [componentsList]
  );

  // Sync when tool prop changes (e.g. after SWR revalidation on save)
  useEffect(() => {
    if (!deepEqual(tool, originalRef.current)) {
      originalRef.current = { ...tool };
      form.reset({ ...tool });
      setHandlerTab(detectHandlerTab(tool));
      onDirtyChange?.(false);
    }
  }, [tool, form, onDirtyChange]);

  useEffect(() => {
    onDraftRef({
      getDraft: () => form.getValues(),
      isDirty: () => !deepEqual(form.getValues(), originalRef.current),
      reset: () => {
        form.reset({ ...originalRef.current });
        setHandlerTab(detectHandlerTab(originalRef.current));
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

  const nameError = useMemo(() => {
    if (!name?.trim()) return "Name is required";
    if (!VALID_NAME_RE.test(name))
      return "Must start with a letter/underscore and contain only letters, digits, underscores";
    return null;
  }, [name]);

  return (
    <FormProvider {...form}>
      <div className="space-y-3 min-w-0">
        <KeyField value={form.getValues("key")} />
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Tool Name
          </label>
          <Input
            className="mt-1 h-8 text-sm"
            {...form.register("name")}
            placeholder="e.g. searchProducts"
            disabled={readOnly}
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
            disabled={readOnly}
          />
        </div>
        <Controller
          name="parametersSchema"
          control={form.control}
          render={({ field }) => (
            <InlineSchemaEditor
              label="Input (JSON Schema / Template)"
              value={field.value ?? null}
              onChange={field.onChange}
              agentId={agentId}
              requireObjectRoot
              readOnly={readOnly}
            />
          )}
        />
        {hideBuiltinSections ? (
          <p className="text-xs text-muted-foreground italic">
            系统内置工具的执行环境与 Handler 由平台管理，不可编辑。
          </p>
        ) : (<>
        <div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              执行环境
            </label>
            <div className="flex items-center rounded-md border border-border p-0.5">
              <button
                type="button"
                onClick={() => form.setValue("executionTarget", "server", { shouldDirty: true })}
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
                  executionTarget === "server"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ServerIcon className="size-3" />
                服务端
              </button>
              <button
                type="button"
                onClick={() => form.setValue("executionTarget", "client", { shouldDirty: true })}
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
                  executionTarget === "client"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MonitorIcon className="size-3" />
                浏览器
              </button>
              <button
                type="button"
                onClick={() => form.setValue("executionTarget", "host", { shouldDirty: true })}
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
                  executionTarget === "host"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GlobeIcon className="size-3" />
                宿主
              </button>
            </div>
          </div>
        </div>
        {executionTarget === "host" ? (
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Handler
            </label>
            <p className="text-xs text-muted-foreground mt-1">
              Handler 由宿主页面通过 <code className="text-xs bg-muted px-1 py-0.5 rounded">ArchonEmbed.registerTools()</code> 提供
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Handler
              </label>
              <GuideDialog title="工具 Handler 编写指南" content={toolHandlerDoc} />
              <div className="flex items-center rounded-md border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setHandlerTab("url")}
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
                    handlerTab === "url"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <GlobeIcon className="size-3" />
                  URL
                </button>
                <button
                  type="button"
                  onClick={() => setHandlerTab("code")}
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
                    handlerTab === "code"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CodeIcon className="size-3" />
                  代码
                </button>
              </div>
              {handlerTab === "code" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-xs"
                  onClick={() => setCodeAssistOpen(true)}
                >
                  <SparklesIcon className="size-3" />
                  AI 编辑
                </Button>
              )}
            </div>

            {handlerTab === "url" ? (
              <Input
                className="mt-1 h-8 text-sm font-mono"
                {...form.register("url")}
                placeholder="https://api.example.com/tool"
              />
            ) : (
              <>
                <Controller
                  name="handler"
                  control={form.control}
                  render={({ field }) => (
                    <JsEditor
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      height="300px"
                      className="mt-1"
                    />
                  )}
                />
                <ToolCodeAssistDialog
                  open={codeAssistOpen}
                  onOpenChange={setCodeAssistOpen}
                  code={form.getValues("handler") ?? ""}
                  toolName={name}
                  toolDescription={form.getValues("description")}
                  agentId={agentId}
                  orgId={orgId}
                  onApply={(src) => form.setValue("handler", src, { shouldDirty: true })}
                />
              </>
            )}
          </div>
        )}
        </>)}
        <Controller
          name="returnParametersSchema"
          control={form.control}
          render={({ field }) => (
            <InlineSchemaEditor
              label="Output (JSON Schema / Template)"
              value={field.value ?? null}
              onChange={field.onChange}
              agentId={agentId}
              requireObjectRoot
              readOnly={readOnly}
            />
          )}
        />
        <div className="flex items-center gap-2">
          <Controller
            name="uiHidden"
            control={form.control}
            render={({ field }) => (
              <Switch
                className="scale-75"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={readOnly}
              />
            )}
          />
          <EyeOffIcon className="size-3.5 text-muted-foreground" />
          <label className="text-xs font-medium text-muted-foreground">
            隐藏工具 UI
          </label>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            UI Component
          </label>
          <Controller
            name="componentId"
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value || "__none__"}
                onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                disabled={readOnly}
              >
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue placeholder="Select a component..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {componentOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
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
