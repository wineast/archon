"use client";

import { useEffect, useMemo, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import deepEqual from "fast-deep-equal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ParameterList } from "@/components/parameters/parameter-list";
import { SchemaIncludesEditor } from "./schema-includes-editor";
import { SchemaResolvedPreview } from "./schema-resolved-preview";
import { useDatasetsMap } from "@/lib/datasets/hooks";
import type { SchemaProperty } from "@/lib/schemas/types";
import type { SchemaWithIncludes } from "@/db/schema";

export interface SchemaFormValues {
  key: string;
  name: string;
  description: string;
  parameters: SchemaProperty[];
  includeSchemaIds: string[];
}

export interface SchemaFormHandle {
  getDraft: () => SchemaFormValues;
  isDirty: () => boolean;
  reset: () => void;
}

interface SchemaFormProps {
  schema: SchemaFormValues;
  onDraftRef: (ref: SchemaFormHandle) => void;
  onDirtyChange?: (dirty: boolean) => void;
  allSchemas?: SchemaWithIncludes[];
  currentSchemaId?: string;
  agentId?: string;
}

export function SchemaForm({
  schema,
  onDraftRef,
  onDirtyChange,
  allSchemas = [],
  currentSchemaId,
  agentId,
}: SchemaFormProps) {
  const form = useForm<SchemaFormValues>({ defaultValues: { ...schema } });
  const originalRef = useRef<SchemaFormValues>({ ...schema });

  // Sync form when schema prop changes (after save + SWR refetch, or switching schemas)
  useEffect(() => {
    if (!deepEqual(schema, originalRef.current)) {
      originalRef.current = { ...schema };
      form.reset({ ...schema });
      onDirtyChange?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

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

  const includeSchemaIds = form.watch("includeSchemaIds") ?? [];
  const parameters = form.watch("parameters") ?? [];

  // Build a virtual schema for the preview
  const previewSchema = useMemo(
    () => ({
      id: currentSchemaId ?? "__new__",
      name: form.getValues("name"),
      parameters,
      includeSchemaIds,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentSchemaId, parameters, includeSchemaIds]
  );

  const { enumDatasetOptions, enumDatasetValues } = useDatasetsMap(agentId);

  // Filter out current schema from schemas list passed to ParameterList
  const schemasForParams = useMemo(
    () => allSchemas.filter((s) => s.id !== currentSchemaId),
    [allSchemas, currentSchemaId]
  );

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
            placeholder="e.g. Address Fields"
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
          />
        </div>

        {/* Includes */}
        {allSchemas.length > 0 && (
          <SchemaIncludesEditor
            includeSchemaIds={includeSchemaIds}
            onChange={(ids) => form.setValue("includeSchemaIds", ids, { shouldDirty: true })}
            allSchemas={allSchemas}
            currentSchemaId={currentSchemaId}
          />
        )}

        {/* Own Fields */}
        <ParameterList
          fieldName="parameters"
          label="Parameters"
          schemas={schemasForParams}
          enumDatasetOptions={enumDatasetOptions}
          enumDatasetValues={enumDatasetValues}
        />

        {/* Resolved Preview */}
        <SchemaResolvedPreview
          schema={previewSchema}
          allSchemas={allSchemas}
        />
      </div>
    </FormProvider>
  );
}
