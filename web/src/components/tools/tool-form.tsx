"use client";

import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/ui/code-editor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ToolDefinition, ToolParameter } from "@/lib/tools/types";
import { useTemplateVarRows } from "@/lib/template-vars/hooks";
import { parseTemplateVarValue } from "@/lib/template-vars/parse";
import { useLookupTablesWithEntries } from "@/lib/lookup-tables/hooks";
import type { EnumRefOption } from "./parameter-row";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HandlerTestPanel } from "./handler-test-panel";
import { ParameterRow } from "./parameter-row";
import { CodeIcon, GlobeIcon, LinkIcon, PlusIcon, TypeIcon } from "lucide-react";

export interface ToolFormHandle {
  getDraft: () => ToolDefinition;
  isDirty: () => boolean;
  reset: () => void;
}

interface ToolFormProps {
  tool: ToolDefinition;
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

export function ToolForm({ tool, onDraftRef, onDirtyChange }: ToolFormProps) {
  const [draft, setDraft] = useState<ToolDefinition>({ ...tool });
  const [handlerMode, setHandlerMode] = useState<HandlerMode>(() =>
    detectHandlerMode(tool.handler)
  );
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const originalRef = useRef(JSON.stringify(tool));

  // Fetch array-type template vars and lookup tables for enum ref options
  const { rows: templateVarRows } = useTemplateVarRows();
  const { tables: lookupTableRows } = useLookupTablesWithEntries();

  const enumRefOptions = useMemo<EnumRefOption[]>(() => {
    const options: EnumRefOption[] = [];
    for (const t of lookupTableRows) {
      options.push({ key: t.key, source: "lookup" });
    }
    for (const v of templateVarRows) {
      if (v.isArray || (v.type === "json" && !v.isArray)) {
        options.push({ key: v.key, source: "var" });
      }
    }
    return options;
  }, [templateVarRows, lookupTableRows]);

  const enumRefValues = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    for (const t of lookupTableRows) {
      if (t.entries?.length) {
        map[t.key] = t.entries.map((e) => e.value);
      }
    }
    for (const v of templateVarRows) {
      if (v.isArray) {
        const parsed = parseTemplateVarValue(v.value, v.type, v.isArray);
        if (Array.isArray(parsed)) {
          map[v.key] = parsed.map(String);
        }
      } else if (v.type === "json") {
        const parsed = parseTemplateVarValue(v.value, v.type, v.isArray);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          map[v.key] = Object.values(parsed as Record<string, unknown>).map(String);
        }
      }
    }
    return map;
  }, [templateVarRows, lookupTableRows]);

  useEffect(() => {
    onDraftRef({
      getDraft: () => draftRef.current,
      isDirty: () => JSON.stringify(draftRef.current) !== originalRef.current,
      reset: () => setDraft({ ...tool }),
    });
  }, [onDraftRef, tool]);

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(draft) !== originalRef.current);
  }, [draft, onDirtyChange]);

  const nameError = useMemo(() => {
    if (!draft.name.trim()) return "Name is required";
    if (!VALID_NAME_RE.test(draft.name))
      return "Must start with a letter/underscore and contain only letters, digits, underscores";
    return null;
  }, [draft.name]);

  const hasHandler = !!draft.handler.trim();

  const handlerHint = useMemo(() => {
    const h = draft.handler.trim();
    if (!h) return null;
    if (h.startsWith("http://") || h.startsWith("https://")) return "remote";
    return "local";
  }, [draft.handler]);

  const outputHint = useMemo(() => {
    if (!draft.output.trim()) return null;
    try {
      JSON.parse(draft.output);
      return null;
    } catch {
      return "Invalid JSON \u2014 will be returned as { result: string }";
    }
  }, [draft.output]);

  const handleParamChange = useCallback(
    (idx: number, updated: ToolParameter) => {
      setDraft((d) => ({
        ...d,
        parameters: d.parameters.map((p, i) => (i === idx ? updated : p)),
      }));
    },
    []
  );

  const handleParamDelete = useCallback((idx: number) => {
    setDraft((d) => ({
      ...d,
      parameters: d.parameters.filter((_, i) => i !== idx),
    }));
  }, []);

  const handleAddParam = useCallback(() => {
    setDraft((d) => ({
      ...d,
      parameters: [
        ...d.parameters,
        {
          id: nanoid(),
          name: "",
          type: "string",
          description: "",
          required: true,
        },
      ],
    }));
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Tool Name
        </label>
        <Input
          className="mt-1 h-8 text-sm"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
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
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="Describe what this tool does and when the AI should use it..."
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Parameters
          </label>
          <Button variant="ghost" size="sm" onClick={handleAddParam}>
            <PlusIcon className="mr-1 size-3" />
            Add
          </Button>
        </div>
        <div className="mt-1 space-y-2">
          {draft.parameters.map((p, idx) => (
            <ParameterRow
              key={p.id}
              parameter={p}
              onChange={(updated) => handleParamChange(idx, updated)}
              onDelete={() => handleParamDelete(idx)}
              enumRefOptions={enumRefOptions}
              enumRefValues={enumRefValues}
            />
          ))}
          {draft.parameters.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              No parameters. This tool will be called without arguments.
            </p>
          )}
        </div>
      </div>
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
              value={draft.handler}
              onChange={(e) => setDraft({ ...draft, handler: e.target.value })}
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
            <CodeEditor
              value={draft.handler}
              onChange={(value) => setDraft({ ...draft, handler: value })}
              language="javascript"
              height="300px"
              className="mt-1"
            />
            <p className="text-xs text-purple-500 mt-1">
              JS 代码 — 运行时动态执行
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              可用 context API：wiki.get(id) → {"{meta, content}"},
              wiki.findByPrefix(prefix), wiki.search(query)
            </p>
            <HandlerTestPanel
              handler={draft.handler}
              parameters={draft.parameters}
            />
          </>
        )}
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Output (JSON)
        </label>
        <CodeEditor
          value={draft.output}
          onChange={(value) => setDraft({ ...draft, output: value })}
          language="json"
          height="150px"
          readOnly={hasHandler}
          className="mt-1"
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
    </div>
  );
}
