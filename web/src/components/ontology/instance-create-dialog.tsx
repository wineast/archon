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
import type { ObjectTypeRow, SchemaRow } from "@/db/schema";
import type { JsonSchema7 } from "@/lib/schemas/types";
import { getDisplayType } from "@/lib/schemas/json-schema-utils";

interface InstanceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  objectType: ObjectTypeRow;
  schema: SchemaRow;
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
  const schemaParams = schema.parameters as JsonSchema7;
  const form = useForm<Record<string, unknown>>({
    defaultValues: buildDefaults(schemaParams),
  });

  const handleCreate = useCallback(async () => {
    const values = form.getValues();
    const data = parseFormValues(values, schemaParams);
    setCreating(true);
    try {
      const result = await createObjectInstance(
        { agentId, objectTypeId: objectType.id, data },
        onCreated
      );
      if (result) {
        form.reset(buildDefaults(schemaParams));
        onOpenChange(false);
      }
    } finally {
      setCreating(false);
    }
  }, [agentId, objectType.id, schemaParams, form, onCreated, onOpenChange]);

  const entries = Object.entries(schemaParams.properties ?? {});

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!creating) {
          if (!v) form.reset(buildDefaults(schemaParams));
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
            {entries.map(([key, propSchema]) => (
              <SchemaField
                key={key}
                name={key}
                propSchema={propSchema}
                isRequired={schemaParams.required?.includes(key) ?? false}
                form={form}
              />
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

function buildDefaults(schema: JsonSchema7): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
    const displayType = getDisplayType(propSchema);
    if (propSchema.default !== undefined) {
      defaults[key] = propSchema.default;
    } else if (displayType === "boolean") {
      defaults[key] = false;
    } else if (displayType === "number" || displayType === "integer") {
      defaults[key] = "";
    } else {
      defaults[key] = "";
    }
  }
  return defaults;
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
