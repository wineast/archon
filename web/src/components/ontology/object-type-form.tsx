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
  titleProperty: string | null;
  source: "internal" | "external";
  externalConfig: Record<string, unknown> | null;
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
  const [titleProperty, setTitleProperty] = useState(values.titleProperty ?? "");
  const [source, setSource] = useState<"internal" | "external">(values.source);
  const [externalConfigJson, setExternalConfigJson] = useState(
    values.externalConfig ? JSON.stringify(values.externalConfig, null, 2) : ""
  );

  const { schemas } = useSchemas(agentId);

  // Get properties from selected schema for titleProperty dropdown
  const selectedSchema = schemas.find((s: SchemaRow) => s.id === (schemaId === NONE ? null : schemaId));
  const schemaProperties = (selectedSchema?.parameters ?? []) as Array<{ name: string }>;

  const initialRef = useRef(values);

  const isDirty = useCallback(() => {
    const init = initialRef.current;
    return (
      name !== init.name ||
      description !== init.description ||
      icon !== init.icon ||
      color !== init.color ||
      (schemaId === NONE ? null : schemaId) !== init.schemaId ||
      (titleProperty || null) !== (init.titleProperty || null) ||
      source !== init.source ||
      externalConfigJson !== (init.externalConfig ? JSON.stringify(init.externalConfig, null, 2) : "")
    );
  }, [name, description, icon, color, schemaId, titleProperty, source, externalConfigJson]);

  useEffect(() => {
    onDirtyChange(isDirty());
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    let parsedExternalConfig: Record<string, unknown> | null = null;
    if (externalConfigJson.trim()) {
      try {
        parsedExternalConfig = JSON.parse(externalConfigJson);
      } catch {
        // keep null if invalid JSON
      }
    }

    onDraftRef({
      getDraft: () => ({
        key: values.key,
        name,
        description,
        icon,
        color,
        schemaId: schemaId === NONE ? null : schemaId,
        titleProperty: titleProperty || null,
        source,
        externalConfig: parsedExternalConfig,
      }),
      reset: () => {
        setName(values.name);
        setDescription(values.description);
        setIcon(values.icon);
        setColor(values.color);
        setSchemaId(values.schemaId ?? NONE);
        setTitleProperty(values.titleProperty ?? "");
        setSource(values.source);
        setExternalConfigJson(
          values.externalConfig ? JSON.stringify(values.externalConfig, null, 2) : ""
        );
      },
    });
  }, [onDraftRef, values, name, description, icon, color, schemaId, titleProperty, source, externalConfigJson]);

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

      {/* Title Property */}
      {schemaProperties.length > 0 && (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Title Property
          </label>
          <Select value={titleProperty || NONE} onValueChange={(v) => setTitleProperty(v === NONE ? "" : v)}>
            <SelectTrigger className="mt-1 h-8 text-sm">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {schemaProperties.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground mt-1">
            Property used as instance display label
          </p>
        </div>
      )}

      {/* Source */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Data Source
        </label>
        <Select value={source} onValueChange={(v) => setSource(v as "internal" | "external")}>
          <SelectTrigger className="mt-1 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="internal">Internal</SelectItem>
            <SelectItem value="external">External</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* External Config */}
      {source === "external" && (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            External Config (JSON)
          </label>
          <Textarea
            className="mt-1 text-sm font-mono"
            rows={6}
            value={externalConfigJson}
            onChange={(e) => setExternalConfigJson(e.target.value)}
            placeholder='{"baseUrl": "https://api.example.com", "authType": "bearer", "authToken": "..."}'
          />
        </div>
      )}
    </div>
  );
}
