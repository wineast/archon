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
import type { ObjectInstanceRow, SchemaWithIncludes } from "@/db/schema";
import type { SchemaProperty } from "@/lib/schemas/types";

interface InstanceEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  instance: ObjectInstanceRow | null;
  schema: SchemaWithIncludes;
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
  schema: SchemaWithIncludes;
  agentId: string;
  mutate: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const originalRef = useRef(buildFormValues(instance.data, schema.parameters));

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
    const data = parseFormValues(values, schema.parameters);
    setSaving(true);
    try {
      const result = await updateObjectInstance(instance.id, { data }, mutate);
      if (result) {
        originalRef.current = buildFormValues(data, schema.parameters);
        form.reset(originalRef.current);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  }, [instance.id, schema.parameters, form, mutate]);

  const handleReset = useCallback(() => {
    form.reset(originalRef.current);
    setDirty(false);
  }, [form]);

  return (
    <>
      <SheetHeader className="px-4 pt-4 pb-2">
        <SheetTitle>{instance.label || "Edit Instance"}</SheetTitle>
        <SheetDescription>Modify instance fields below.</SheetDescription>
      </SheetHeader>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 px-4 pb-4">
          {schema.parameters.map((prop) => (
            <EditField key={prop.id} prop={prop} form={form} />
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
  prop,
  form,
}: {
  prop: SchemaProperty;
  form: ReturnType<typeof useForm<Record<string, unknown>>>;
}) {
  const fieldName = prop.name;

  switch (prop.type) {
    case "string":
      return (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {prop.name}
            {prop.required && <span className="text-destructive ml-0.5">*</span>}
          </label>
          <Input
            className="mt-1 h-8 text-sm"
            {...form.register(fieldName)}
            placeholder={prop.description || prop.name}
          />
        </div>
      );

    case "number":
      return (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {prop.name}
            {prop.required && <span className="text-destructive ml-0.5">*</span>}
          </label>
          <Input
            className="mt-1 h-8 text-sm"
            type="number"
            {...form.register(fieldName)}
            placeholder={prop.description || prop.name}
          />
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center justify-between py-1">
          <label className="text-xs font-medium text-muted-foreground">
            {prop.name}
          </label>
          <Controller
            control={form.control}
            name={fieldName}
            render={({ field }) => (
              <Switch
                checked={!!field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      );

    case "enum":
      return (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {prop.name}
            {prop.required && <span className="text-destructive ml-0.5">*</span>}
          </label>
          <Controller
            control={form.control}
            name={fieldName}
            render={({ field }) => (
              <Select
                value={field.value as string ?? ""}
                onValueChange={field.onChange}
              >
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue placeholder={`Select ${prop.name}`} />
                </SelectTrigger>
                <SelectContent>
                  {(prop.enum ?? []).map((val) => (
                    <SelectItem key={val} value={val}>
                      {val}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      );

    default:
      return (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {prop.name} ({prop.type})
            {prop.required && <span className="text-destructive ml-0.5">*</span>}
          </label>
          <Textarea
            className="mt-1 text-sm font-mono"
            rows={3}
            {...form.register(fieldName)}
            placeholder={`JSON for ${prop.type}`}
          />
        </div>
      );
  }
}

function buildFormValues(
  data: Record<string, unknown>,
  params: SchemaProperty[]
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const p of params) {
    const val = data[p.name];
    switch (p.type) {
      case "boolean":
        values[p.name] = !!val;
        break;
      case "number":
        values[p.name] = val != null ? String(val) : "";
        break;
      case "object":
      case "array":
      case "union":
        values[p.name] = val != null ? JSON.stringify(val, null, 2) : "";
        break;
      default:
        values[p.name] = val != null ? String(val) : "";
        break;
    }
  }
  return values;
}

function parseFormValues(
  raw: Record<string, unknown>,
  params: SchemaProperty[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const p of params) {
    const val = raw[p.name];
    switch (p.type) {
      case "number": {
        const num = Number(val);
        result[p.name] = val === "" || val == null ? undefined : num;
        break;
      }
      case "boolean":
        result[p.name] = !!val;
        break;
      case "object":
      case "array":
      case "union": {
        if (typeof val === "string" && val.trim()) {
          try {
            result[p.name] = JSON.parse(val);
          } catch {
            result[p.name] = val;
          }
        }
        break;
      }
      default:
        if (val !== "" && val != null) result[p.name] = val;
        break;
    }
  }
  return result;
}
