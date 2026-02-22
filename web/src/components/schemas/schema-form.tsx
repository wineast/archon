"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import deepEqual from "fast-deep-equal";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyField } from "@/components/ui/key-field";
import { Textarea } from "@/components/ui/textarea";
import { GuideDialog } from "@/components/ui/guide-dialog";
import { JsonEditor } from "@/components/editors/json-editor";
import { SchemaCodeAssistDialog } from "./schema-code-assist-dialog";
import type { JsonSchema7 } from "@/lib/schemas/types";
import { EMPTY_OBJECT_SCHEMA } from "@/lib/schemas/types";
import schemaGuideContent from "../../../guide/schema.md";

export interface SchemaFormValues {
  key: string;
  name: string;
  description: string;
  parameters: JsonSchema7;
}

export interface SchemaFormHandle {
  getDraft: () => SchemaFormValues;
  isDirty: () => boolean;
  reset: () => void;
  /** Mark current form values as the new baseline (clears dirty state). */
  markClean: () => void;
}

interface SchemaFormProps {
  schema: SchemaFormValues;
  onDraftRef: (ref: SchemaFormHandle) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Rendered between metadata fields and Parameters section. */
  children?: React.ReactNode;
  /** When true, hide JSON editor (keeps form fields registered). */
  parametersHidden?: boolean;
  /** Context string for AI code assist (e.g. summary of all schemas). */
  context?: string;
  /** Dataset variable names for template autocompletion in JSON editor. */
  templateVariableNames?: string[];
  /** Dataset key→data map for {{key.field}} nested completions in JSON editor. */
  templateVariableMap?: Record<string, unknown>;
  /** Agent ID for BYOK model resolution in AI assist. */
  agentId?: string;
  /** When true, all fields are disabled/readOnly. */
  readOnly?: boolean;
}

/**
 * Compare two values ignoring `undefined` properties that react-hook-form
 * adds internally for registered-but-empty fields.
 * JSON round-trip strips `undefined`, then deepEqual handles key ordering.
 */
function formEqual(a: unknown, b: unknown): boolean {
  return deepEqual(
    JSON.parse(JSON.stringify(a)),
    JSON.parse(JSON.stringify(b))
  );
}

export function SchemaForm({
  schema,
  onDraftRef,
  onDirtyChange,
  children,
  parametersHidden,
  context,
  templateVariableNames,
  templateVariableMap,
  agentId,
  readOnly,
}: SchemaFormProps) {
  const form = useForm<SchemaFormValues>({ defaultValues: { ...schema } });
  const originalRef = useRef<SchemaFormValues>({ ...schema });
  const [schemaAssistOpen, setSchemaAssistOpen] = useState(false);

  // Sync form when schema prop changes (after save + SWR refetch, or switching schemas)
  useEffect(() => {
    if (!formEqual(schema, originalRef.current)) {
      originalRef.current = { ...schema };
      form.reset({ ...schema });
      onDirtyChange?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  useEffect(() => {
    onDraftRef({
      getDraft: () => form.getValues(),
      isDirty: () => !formEqual(form.getValues(), originalRef.current),
      reset: () => {
        form.reset({ ...originalRef.current });
      },
      markClean: () => {
        originalRef.current = { ...form.getValues() };
        onDirtyChange?.(false);
      },
    });
  }, [onDraftRef, form, onDirtyChange]);

  useEffect(() => {
    let wasDirty = false;
    const subscription = form.watch(() => {
      const isDirty = !formEqual(form.getValues(), originalRef.current);
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
        <KeyField value={form.getValues("key")} />
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Name
          </label>
          <Input
            className="mt-1 h-8 text-sm"
            {...form.register("name")}
            placeholder="e.g. Address Fields"
            disabled={readOnly}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Description
          </label>
          <Textarea
            className="mt-1 min-h-[60px] resize-none text-sm"
            {...form.register("description")}
            placeholder="Describe what this schema represents..."
            disabled={readOnly}
          />
        </div>

        {/* Parameters header with Guide + AI edit */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            JSON Schema / Template
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
          schema={JSON.stringify(form.getValues("parameters") ?? EMPTY_OBJECT_SCHEMA, null, 2)}
          context={context}
          agentId={agentId}
          onApply={(newSchemaText) => {
            try {
              form.setValue("parameters", JSON.parse(newSchemaText), { shouldDirty: true });
            } catch {
              // Invalid JSON — ignore
            }
          }}
        />

        {children}

        <div className={parametersHidden ? "hidden" : undefined}>
          <Controller
            name="parameters"
            control={form.control}
            render={({ field }) => (
              <JsonEditor
                value={JSON.stringify(field.value ?? EMPTY_OBJECT_SCHEMA, null, 2)}
                onChange={(text) => {
                  try {
                    field.onChange(JSON.parse(text));
                  } catch {
                    // JSON not valid yet — user is still typing
                  }
                }}
                height="400px"
                templateVariables={templateVariableNames}
                templateVariableMap={templateVariableMap}
                readOnly={readOnly}
              />
            )}
          />
        </div>
      </div>
    </FormProvider>
  );
}
