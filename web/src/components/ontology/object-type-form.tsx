"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSchemas } from "@/lib/schemas/hooks";
import type { SchemaRow } from "@/db/schema";

export interface ObjectTypeFormValues {
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  schemaId: string | null;
}

export interface ObjectTypeFormHandle {
  getDraft: () => ObjectTypeFormValues;
  reset: () => void;
}

interface ObjectTypeFormProps {
  agentId: string;
  values: ObjectTypeFormValues;
  onDraftRef: (ref: ObjectTypeFormHandle) => void;
  onDirtyChange: (dirty: boolean) => void;
}

export function ObjectTypeForm({
  agentId,
  values,
  onDraftRef,
  onDirtyChange,
}: ObjectTypeFormProps) {
  const [name, setName] = useState(values.name);
  const [description, setDescription] = useState(values.description);
  const [icon, setIcon] = useState(values.icon);
  const [color, setColor] = useState(values.color);
  const NONE = "__none__";
  const [schemaId, setSchemaId] = useState(values.schemaId ?? NONE);

  const { schemas } = useSchemas(agentId);

  const initialRef = useRef(values);

  const isDirty = useCallback(() => {
    const init = initialRef.current;
    return (
      name !== init.name ||
      description !== init.description ||
      icon !== init.icon ||
      color !== init.color ||
      (schemaId === NONE ? null : schemaId) !== init.schemaId
    );
  }, [name, description, icon, color, schemaId]);

  useEffect(() => {
    onDirtyChange(isDirty());
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onDraftRef({
      getDraft: () => ({
        key: values.key,
        name,
        description,
        icon,
        color,
        schemaId: schemaId === NONE ? null : schemaId,
      }),
      reset: () => {
        setName(values.name);
        setDescription(values.description);
        setIcon(values.icon);
        setColor(values.color);
        setSchemaId(values.schemaId ?? NONE);
      },
    });
  }, [onDraftRef, values, name, description, icon, color, schemaId]);

  return (
    <div className="space-y-4">
      {/* Key (read-only) */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Key</label>
        <Input
          className="mt-1 h-8 text-sm font-mono"
          value={values.key}
          readOnly
          disabled
        />
      </div>

      {/* Name */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Name</label>
        <Input
          className="mt-1 h-8 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Display name"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Description
        </label>
        <Textarea
          className="mt-1 text-sm"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this object type for AI understanding"
        />
      </div>

      {/* Icon */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Icon</label>
        <Input
          className="mt-1 h-8 text-sm"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="Lucide icon name (e.g. user, building)"
        />
      </div>

      {/* Color */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Color</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="size-8 cursor-pointer rounded border p-0.5"
          />
          <Input
            className="h-8 text-sm font-mono flex-1"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#6366f1"
          />
        </div>
      </div>

      {/* Schema */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Schema (properties)
        </label>
        <Select value={schemaId} onValueChange={setSchemaId}>
          <SelectTrigger className="mt-1 h-8 text-sm">
            <SelectValue placeholder="No schema" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {schemas.map((s: SchemaRow) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
