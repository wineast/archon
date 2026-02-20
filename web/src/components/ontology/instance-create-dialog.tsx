"use client";

import { useCallback, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createObjectInstance } from "@/lib/ontology/hooks";
import type { ObjectTypeRow, SchemaWithIncludes } from "@/db/schema";
import type { SchemaProperty } from "@/lib/schemas/types";

interface InstanceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  objectType: ObjectTypeRow;
  schema: SchemaWithIncludes;
  onCreated: () => void;
}

export function InstanceCreateDialog({
  open,
  onOpenChange,
  agentId,
  objectType,
  schema,
  onCreated,
}: InstanceCreateDialogProps) {
  const [creating, setCreating] = useState(false);
  const form = useForm<Record<string, unknown>>({
    defaultValues: buildDefaults(schema.parameters),
  });

  const handleCreate = useCallback(async () => {
    const values = form.getValues();
    const data = parseFormValues(values, schema.parameters);
    setCreating(true);
    try {
      const result = await createObjectInstance(
        { agentId, objectTypeId: objectType.id, data },
        onCreated
      );
      if (result) {
        form.reset(buildDefaults(schema.parameters));
        onOpenChange(false);
      }
    } finally {
      setCreating(false);
    }
  }, [agentId, objectType.id, schema.parameters, form, onCreated, onOpenChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!creating) {
          if (!v) form.reset(buildDefaults(schema.parameters));
          onOpenChange(v);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New {objectType.name} Instance</DialogTitle>
          <DialogDescription>
            Fill in the fields to create a new instance.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-4">
            {schema.parameters.map((prop) => (
              <SchemaField key={prop.id} prop={prop} form={form} />
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating && <Spinner className="mr-1.5 size-3" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SchemaField({
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

function buildDefaults(params: SchemaProperty[]): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const p of params) {
    if (p.defaultValue !== undefined) {
      defaults[p.name] = p.defaultValue;
    } else if (p.type === "boolean") {
      defaults[p.name] = false;
    } else if (p.type === "number") {
      defaults[p.name] = "";
    } else {
      defaults[p.name] = "";
    }
  }
  return defaults;
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
