"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { RotateCcwIcon, SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { updateObjectInstance } from "@/lib/ontology/hooks";
import equal from "fast-deep-equal";
import type { ObjectInstanceRow, SchemaRow } from "@/db/schema";
import type { JsonSchema7 } from "@/lib/schemas/types";
import { getDisplayType } from "@/lib/schemas/json-schema-utils";

interface InstanceEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  instance: ObjectInstanceRow | null;
  schema: SchemaRow;
  mutate: () => void;
}

export function InstanceEditSheet({
  open,
  onOpenChange,
  agentId,
  instance,
  schema,
  mutate,
}: InstanceEditSheetProps) {
  if (!instance) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0">
        <InstanceEditSheetInner
          instance={instance}
          schema={schema}
          agentId={agentId}
          mutate={mutate}
        />
      </SheetContent>
    </Sheet>
  );
}

function InstanceEditSheetInner({
  instance,
  schema,
  agentId,
  mutate,
}: {
  instance: ObjectInstanceRow;
  schema: SchemaRow;
  agentId: string;
  mutate: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const schemaParams = schema.parameters as JsonSchema7;
  const originalRef = useRef(buildFormValues(instance.data, schemaParams));

  const form = useForm<Record<string, unknown>>({
    defaultValues: originalRef.current,
  });

  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const sub = form.watch(() => {
      const current = form.getValues();
      setDirty(!equal(current, originalRef.current));
    });
    return () => sub.unsubscribe();
  }, [form]);

  const handleSave = useCallback(async () => {
    const values = form.getValues();
    const data = parseFormValues(values, schemaParams);
    setSaving(true);
    try {
      const result = await updateObjectInstance(instance.id, { data }, mutate);
      if (result) {
        originalRef.current = buildFormValues(data, schemaParams);
        form.reset(originalRef.current);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  }, [instance.id, schemaParams, form, mutate]);

  const handleReset = useCallback(() => {
    form.reset(originalRef.current);
    setDirty(false);
  }, [form]);

  const entries = Object.entries(schemaParams.properties ?? {});

  return (
    <>
      <SheetHeader className="px-4 pt-4 pb-2">
        <SheetTitle>{instance.label || "Edit Instance"}</SheetTitle>
        <SheetDescription>Modify instance fields below.</SheetDescription>
      </SheetHeader>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 px-4 pb-4">
          {entries.map(([key, propSchema]) => (
            <EditField
              key={key}
              name={key}
              propSchema={propSchema}
              isRequired={schemaParams.required?.includes(key) ?? false}
              form={form}
            />
          ))}
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? (
            <Spinner className="mr-1 size-3" />
          ) : (
            <SaveIcon className="mr-1 size-3" />
          )}
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={saving || !dirty}
        >
          <RotateCcwIcon className="mr-1 size-3" />
          Reset
        </Button>
      </div>
    </>
  );
}

function EditField({
  name,
  propSchema,
  isRequired,
  form,
}: {
  name: string;
  propSchema: JsonSchema7;
  isRequired: boolean;
  form: ReturnType<typeof useForm<Record<string, unknown>>>;
}) {
  const displayType = getDisplayType(propSchema);

  switch (displayType) {
    case "string":
      // String with enum constraint — show select
      if (propSchema.enum && propSchema.enum.length > 0) {
        return (
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {name}
              {isRequired && <span className="text-destructive ml-0.5">*</span>}
            </label>
            <Controller
              control={form.control}
              name={name}
              render={({ field }) => (
                <Select
                  value={field.value as string ?? ""}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue placeholder={`Select ${name}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {(propSchema.enum ?? []).map((val) => (
                      <SelectItem key={String(val)} value={String(val)}>
                        {String(val)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        );
      }
      return (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {name}
            {isRequired && <span className="text-destructive ml-0.5">*</span>}
          </label>
          <Input
            className="mt-1 h-8 text-sm"
            {...form.register(name)}
            placeholder={propSchema.description || name}
          />
        </div>
      );

    case "number":
    case "integer":
      return (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {name}
            {isRequired && <span className="text-destructive ml-0.5">*</span>}
          </label>
          <Input
            className="mt-1 h-8 text-sm"
            type="number"
            {...form.register(name)}
            placeholder={propSchema.description || name}
          />
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center justify-between py-1">
          <label className="text-xs font-medium text-muted-foreground">
            {name}
          </label>
          <Controller
            control={form.control}
            name={name}
            render={({ field }) => (
              <Switch
                checked={!!field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      );

    default:
      return (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {name} ({displayType})
            {isRequired && <span className="text-destructive ml-0.5">*</span>}
          </label>
          <Textarea
            className="mt-1 text-sm font-mono"
            rows={3}
            {...form.register(name)}
            placeholder={`JSON for ${displayType}`}
          />
        </div>
      );
  }
}

function buildFormValues(
  data: Record<string, unknown>,
  schema: JsonSchema7
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
    const val = data[key];
    const displayType = getDisplayType(propSchema);
    switch (displayType) {
      case "boolean":
        values[key] = !!val;
        break;
      case "number":
      case "integer":
        values[key] = val != null ? String(val) : "";
        break;
      case "object":
      case "array":
      case "union":
        values[key] = val != null ? JSON.stringify(val, null, 2) : "";
        break;
      default:
        values[key] = val != null ? String(val) : "";
        break;
    }
  }
  return values;
}

function parseFormValues(
  raw: Record<string, unknown>,
  schema: JsonSchema7
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
    const val = raw[key];
    const displayType = getDisplayType(propSchema);
    switch (displayType) {
      case "number":
      case "integer": {
        const num = Number(val);
        result[key] = val === "" || val == null ? undefined : num;
        break;
      }
      case "boolean":
        result[key] = !!val;
        break;
      case "object":
      case "array":
      case "union": {
        if (typeof val === "string" && val.trim()) {
          try {
            result[key] = JSON.parse(val);
          } catch {
            result[key] = val;
          }
        }
        break;
      }
      default:
        if (val !== "" && val != null) result[key] = val;
        break;
    }
  }
  return result;
}
