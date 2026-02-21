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
import { KeyField } from "@/components/ui/key-field";
import { Textarea } from "@/components/ui/textarea";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JsEditor } from "@/components/editors/js-editor";
import { InlineSchemaEditor } from "@/components/schemas/inline-schema-editor";
import { FunctionCodeAssistDialog } from "./function-code-assist-dialog";
import type { JsonSchema7 } from "@/lib/schemas/types";

export interface FunctionFormValues {
  name: string;
  description: string;
  code: string;
  parametersSchema: JsonSchema7 | null;
  returnParametersSchema: JsonSchema7 | null;
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
  parametersSchema: JsonSchema7 | null;
  returnParametersSchema: JsonSchema7 | null;
  onDraftRef: (ref: FunctionFormHandle) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function FunctionForm({
  agentId,
  functionKey,
  name: initialName,
  description: initialDescription,
  code: initialCode,
  parametersSchema: initialParametersSchema,
  returnParametersSchema: initialReturnParametersSchema,
  onDraftRef,
  onDirtyChange,
}: FunctionFormProps) {
  const defaultValues: FunctionFormValues = {
    name: initialName,
    description: initialDescription,
    code: initialCode,
    parametersSchema: initialParametersSchema ?? null,
    returnParametersSchema: initialReturnParametersSchema ?? null,
  };

  const form = useForm<FunctionFormValues>({ defaultValues });
  const originalRef = useRef<FunctionFormValues>({ ...defaultValues });

  const parametersSchema = useWatch({ control: form.control, name: "parametersSchema" });
  const returnParametersSchema = useWatch({ control: form.control, name: "returnParametersSchema" });
  const currentCode = useWatch({ control: form.control, name: "code" });
  const [codeAssistOpen, setCodeAssistOpen] = useState(false);

  const codeAssistContext = useMemo(() => {
    const parts: string[] = [];
    if (parametersSchema) {
      parts.push(`### 参数 Schema\n\`\`\`json\n${JSON.stringify(parametersSchema, null, 2)}\n\`\`\``);
    }
    if (returnParametersSchema) {
      parts.push(`### 返回值 Schema\n\`\`\`json\n${JSON.stringify(returnParametersSchema, null, 2)}\n\`\`\``);
    }
    return parts.length > 0 ? parts.join("\n\n") : undefined;
  }, [parametersSchema, returnParametersSchema]);

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
        <KeyField value={functionKey} />
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

        <Controller
          name="parametersSchema"
          control={form.control}
          render={({ field }) => (
            <InlineSchemaEditor
              label="Parameters"
              value={field.value ?? null}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          name="returnParametersSchema"
          control={form.control}
          render={({ field }) => (
            <InlineSchemaEditor
              label="Return Parameters"
              value={field.value ?? null}
              onChange={field.onChange}
            />
          )}
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
