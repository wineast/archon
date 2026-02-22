"use client";

import { useCallback, useMemo, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideDialog } from "@/components/ui/guide-dialog";
import { JsonEditor } from "@/components/editors/json-editor";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchemaParameterPreview } from "./schema-parameter-preview";
import { SchemaCodeAssistDialog } from "./schema-code-assist-dialog";
import { useDatasetVarsMap } from "@/lib/datasets/hooks";
import type { JsonSchema7 } from "@/lib/schemas/types";
import { isObjectSchema } from "@/lib/schemas/json-schema-utils";
import schemaGuideContent from "../../../guide/schema.md";

const DEFAULT_SCHEMA: JsonSchema7 = { type: "object", properties: {}, required: [] };

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

interface InlineSchemaEditorProps {
  value: JsonSchema7 | null;
  onChange: (v: JsonSchema7) => void;
  label: string;
  /** Agent ID — enables template completions, preview, and AI assist. */
  agentId?: string;
  /** When true, root schema must be an object type (has type:"object", properties, allOf, $ref, etc.). */
  requireObjectRoot?: boolean;
}

export function InlineSchemaEditor({
  value,
  onChange,
  label,
  agentId,
  requireObjectRoot,
}: InlineSchemaEditorProps) {
  const schema = value ?? DEFAULT_SCHEMA;

  const [customJson, setCustomJson] = useState<string>(() =>
    JSON.stringify(schema, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("edit");
  const [previewContent, setPreviewContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewJsonError, setPreviewJsonError] = useState<string | null>(null);
  const [schemaAssistOpen, setSchemaAssistOpen] = useState(false);

  // Dataset variables for template completions
  const { datasetVars } = useDatasetVarsMap(agentId);
  const templateVariables = useMemo(
    () => Object.keys(datasetVars),
    [datasetVars]
  );
  const hasTemplateSupport = agentId && templateVariables.length > 0;

  const handleChange = useCallback(
    (v: string) => {
      setCustomJson(v);
      // Contains Liquid template syntax → skip JSON validation
      if (/\{\{.*?\}\}|\{%.*?%\}/.test(v)) {
        setJsonError(null);
        try {
          const parsed = JSON.parse(v);
          onChange(parsed);
        } catch {
          // Template text that isn't valid JSON yet — don't update form value
        }
        return;
      }
      try {
        const parsed = JSON.parse(v);
        if (!isPlainObject(parsed)) {
          setJsonError("Schema must be a JSON object");
          return;
        }
        if (requireObjectRoot && !isObjectSchema(parsed)) {
          setJsonError("Root schema must be an object type");
          return;
        }
        setJsonError(null);
        onChange(parsed);
      } catch (err) {
        setJsonError((err as Error).message);
      }
    },
    [onChange, requireObjectRoot]
  );

  const handlePreview = useCallback(async () => {
    if (!customJson || !agentId) {
      setPreviewContent(customJson);
      setPreviewJsonError(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewJsonError(null);
    try {
      const res = await fetch("/api/schema/template/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: customJson, agentId, expandRefs: true }),
      });
      const { rendered } = await res.json();
      setPreviewContent(rendered);
      try {
        JSON.parse(rendered);
      } catch (err) {
        setPreviewJsonError((err as Error).message);
      }
    } catch {
      setPreviewContent(customJson);
    } finally {
      setPreviewLoading(false);
    }
  }, [customJson, agentId]);

  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      if (value === "preview") {
        handlePreview();
      }
    },
    [handlePreview]
  );

  const handleAssistApply = useCallback(
    (newSchemaText: string) => {
      setCustomJson(newSchemaText);
      try {
        const parsed = JSON.parse(newSchemaText);
        setJsonError(null);
        onChange(parsed);
      } catch {
        // AI might produce template text — don't error
      }
    },
    [onChange]
  );

  return (
    <div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <GuideDialog title="Schema 编辑指南" content={schemaGuideContent} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-xs"
          onClick={() => setSchemaAssistOpen(true)}
        >
          <SparklesIcon className="size-3" />
          AI 编辑
        </Button>
      </div>
      <SchemaCodeAssistDialog
        open={schemaAssistOpen}
        onOpenChange={setSchemaAssistOpen}
        schema={customJson}
        agentId={agentId}
        onApply={handleAssistApply}
      />
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-1">
        <TabsList className="h-7">
          <TabsTrigger value="edit" className="text-xs">Edit</TabsTrigger>
          {hasTemplateSupport && (
            <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
          )}
          <TabsTrigger value="parameters" className="text-xs">Parameters</TabsTrigger>
        </TabsList>
        <TabsContent value="edit">
          <JsonEditor
            value={customJson}
            onChange={handleChange}
            height="300px"
            templateVariables={hasTemplateSupport ? templateVariables : undefined}
            templateVariableMap={hasTemplateSupport ? datasetVars : undefined}
          />
          {jsonError && (
            <p className="mt-1 text-xs text-destructive">{jsonError}</p>
          )}
        </TabsContent>
        {hasTemplateSupport && (
          <TabsContent value="preview">
            {previewLoading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-md border">
                <Spinner className="size-5" />
              </div>
            ) : (
              <JsonEditor
                value={previewContent}
                height="300px"
                readOnly
              />
            )}
            {previewJsonError && (
              <p className="mt-1 text-xs text-destructive">
                Rendered output is not valid JSON: {previewJsonError}
              </p>
            )}
          </TabsContent>
        )}
        <TabsContent value="parameters">
          <SchemaParameterPreview schema={schema} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
