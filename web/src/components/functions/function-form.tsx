"use client";

import { useEffect, useRef } from "react";
import {
  Controller,
  FormProvider,
  useForm,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JsEditor } from "@/components/ui/editors/js-editor";
import { ParameterList } from "@/components/parameters/parameter-list";
import { ReturnParameterList } from "@/components/parameters/return-parameter-list";
import type { ToolParameter } from "@/lib/tools/types";

export interface FunctionFormValues {
  name: string;
  description: string;
  code: string;
  parameters: ToolParameter[];
  returnParameters: ToolParameter[];
}

export interface FunctionFormHandle {
  getDraft: () => FunctionFormValues;
  isDirty: () => boolean;
  reset: () => void;
}

interface FunctionFormProps {
  functionKey: string;
  name: string;
  description: string;
  code: string;
  parameters: ToolParameter[];
  returnParameters: ToolParameter[];
  onDraftRef: (ref: FunctionFormHandle) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function FunctionForm({
  functionKey,
  name: initialName,
  description: initialDescription,
  code: initialCode,
  parameters: initialParameters,
  returnParameters: initialReturnParameters,
  onDraftRef,
  onDirtyChange,
}: FunctionFormProps) {
  const defaultValues: FunctionFormValues = {
    name: initialName,
    description: initialDescription,
    code: initialCode,
    parameters: initialParameters ?? [],
    returnParameters: initialReturnParameters ?? [],
  };

  const form = useForm<FunctionFormValues>({ defaultValues });
  const originalRef = useRef(JSON.stringify(defaultValues));

  // Expose handle to parent
  useEffect(() => {
    onDraftRef({
      getDraft: () => form.getValues(),
      isDirty: () =>
        JSON.stringify(form.getValues()) !== originalRef.current,
      reset: () => {
        const original = JSON.parse(originalRef.current);
        form.reset(original);
      },
    });
  }, [onDraftRef, form]);

  // Notify dirty state changes
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

        <ParameterList fieldName="parameters" label="Parameters" />
        <ReturnParameterList
          fieldName="returnParameters"
          label="Return Parameters"
        />

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Code (JavaScript)
          </label>
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
