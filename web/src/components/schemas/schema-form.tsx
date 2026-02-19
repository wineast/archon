"use client";

import { useEffect, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ParameterList } from "@/components/parameters/parameter-list";
import type { ToolParameter } from "@/lib/tools/types";

export interface SchemaFormValues {
  key: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
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
}

export function SchemaForm({ schema, onDraftRef, onDirtyChange }: SchemaFormProps) {
  const form = useForm<SchemaFormValues>({ defaultValues: { ...schema } });
  const originalRef = useRef(JSON.stringify(schema));

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
        <ParameterList
          fieldName="parameters"
          label="Parameters"
        />
      </div>
    </FormProvider>
  );
}
