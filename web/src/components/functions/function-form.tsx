"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  useWatch,
} from "react-hook-form";
import deepEqual from "fast-deep-equal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JsEditor } from "@/components/editors/js-editor";
import { useSchemas } from "@/lib/schemas/hooks";
import { SchemaParameterPreview } from "@/components/schemas/schema-parameter-preview";
import { FunctionCodeAssistDialog } from "./function-code-assist-dialog";
import type { SchemaProperty } from "@/lib/schemas/types";

export interface FunctionFormValues {
  name: string;
  description: string;
  code: string;
  parametersSchemaId: string | null;
  returnParametersSchemaId: string | null;
}

export interface FunctionFormHandle {
  getDraft: () => FunctionFormValues;
  isDirty: () => boolean;
  reset: () => void;
}

interface FunctionFormProps {
  agentId: string;
  functionKey: string;
  name: string;
  description: string;
  code: string;
  parametersSchemaId: string | null;
  returnParametersSchemaId: string | null;
  onDraftRef: (ref: FunctionFormHandle) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

interface ParameterSectionProps {
  label: string;
  schemaIdFieldName: "parametersSchemaId" | "returnParametersSchemaId";
  schemaIdValue: string | null | undefined;
  schemas: { id: string; key: string; name: string; parameters: SchemaProperty[] }[];
  form: ReturnType<typeof useForm<FunctionFormValues>>;
}

function ParameterSection({
  label,
  schemaIdFieldName,
  schemaIdValue,
  schemas,
  form,
}: ParameterSectionProps) {
  const selectedSchema = schemas.find((s) => s.id === schemaIdValue);

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="mt-1 space-y-2">
        <Controller
          name={schemaIdFieldName}
          control={form.control}
          render={({ field }) => (
            <Select
              value={field.value ?? "__none__"}
              onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select a schema..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {schemas.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
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
    </div>
  );
}

export function FunctionForm({
  agentId,
  functionKey,
  name: initialName,
  description: initialDescription,
  code: initialCode,
  parametersSchemaId: initialParametersSchemaId,
  returnParametersSchemaId: initialReturnParametersSchemaId,
  onDraftRef,
  onDirtyChange,
}: FunctionFormProps) {
  const { schemas } = useSchemas(agentId);

  const defaultValues: FunctionFormValues = {
    name: initialName,
    description: initialDescription,
    code: initialCode,
    parametersSchemaId: initialParametersSchemaId ?? null,
    returnParametersSchemaId: initialReturnParametersSchemaId ?? null,
  };

  const form = useForm<FunctionFormValues>({ defaultValues });
  const originalRef = useRef<FunctionFormValues>({ ...defaultValues });

  const parametersSchemaId = useWatch({ control: form.control, name: "parametersSchemaId" });
  const returnParametersSchemaId = useWatch({ control: form.control, name: "returnParametersSchemaId" });
  const currentCode = useWatch({ control: form.control, name: "code" });
  const [codeAssistOpen, setCodeAssistOpen] = useState(false);

  const codeAssistContext = useMemo(() => {
    const parts: string[] = [];
    const paramsSchema = schemas.find((s) => s.id === parametersSchemaId);
    if (paramsSchema) {
      parts.push(`### 参数 Schema: ${paramsSchema.name} (${paramsSchema.key})\n\`\`\`json\n${JSON.stringify(paramsSchema.parameters, null, 2)}\n\`\`\``);
    }
    const returnSchema = schemas.find((s) => s.id === returnParametersSchemaId);
    if (returnSchema) {
      parts.push(`### 返回值 Schema: ${returnSchema.name} (${returnSchema.key})\n\`\`\`json\n${JSON.stringify(returnSchema.parameters, null, 2)}\n\`\`\``);
    }
    return parts.length > 0 ? parts.join("\n\n") : undefined;
  }, [schemas, parametersSchemaId, returnParametersSchemaId]);

  // Expose handle to parent
  useEffect(() => {
    onDraftRef({
      getDraft: () => form.getValues(),
      isDirty: () => !deepEqual(form.getValues(), originalRef.current),
      reset: () => {
        form.reset({ ...originalRef.current });
      },
    });
  }, [onDraftRef, form]);

  // Notify dirty state changes
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

  return (
    <FormProvider {...form}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Key
          </label>
          <Input
            className="mt-1 h-8 text-sm font-mono bg-muted"
            value={functionKey}
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
            placeholder="Display name"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Description
          </label>
          <Textarea
            className="mt-1 min-h-[60px] resize-none text-sm"
            {...form.register("description")}
            placeholder="What this function does..."
          />
        </div>

        <ParameterSection
          label="Parameters"
          schemaIdFieldName="parametersSchemaId"
          schemaIdValue={parametersSchemaId}
          schemas={schemas}
          form={form}
        />
        <ParameterSection
          label="Return Parameters"
          schemaIdFieldName="returnParametersSchemaId"
          schemaIdValue={returnParametersSchemaId}
          schemas={schemas}
          form={form}
        />

        <div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Code (JavaScript)
            </label>
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
          </div>
          <FunctionCodeAssistDialog
            open={codeAssistOpen}
            onOpenChange={setCodeAssistOpen}
            code={currentCode}
            context={codeAssistContext}
            onApply={(newCode) => form.setValue("code", newCode, { shouldDirty: true })}
          />
          <div className="mt-1">
            <Controller
              name="code"
              control={form.control}
              render={({ field }) => (
                <JsEditor
                  value={field.value}
                  onChange={field.onChange}
                  height="400px"
                />
              )}
            />
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
