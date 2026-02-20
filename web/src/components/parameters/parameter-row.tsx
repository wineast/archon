"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { JsonEditor } from "@/components/editors/json-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { SchemaPropertyType } from "@/lib/schemas/types";
import type { SchemaRow } from "@/db/schema";
import { BracesIcon, PlusIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { nanoid } from "nanoid";

const PARAM_TYPES: { value: SchemaPropertyType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "enum", label: "Enum" },
  { value: "object", label: "Object" },
  { value: "array", label: "Array" },
  { value: "union", label: "Union" },
  { value: "null", label: "Null" },
  { value: "const", label: "Const" },
];

/** Item types available when type === "array" */
const ARRAY_ITEM_TYPES: { value: SchemaPropertyType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "enum", label: "Enum" },
  { value: "object", label: "Object" },
];

/** Value types for additionalProperties (Map/Record) */
const MAP_VALUE_TYPES: { value: SchemaPropertyType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "object", label: "Object" },
];

/** Types available for union variant entries */
const UNION_VARIANT_TYPES: { value: SchemaPropertyType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "enum", label: "Enum" },
  { value: "object", label: "Object" },
  { value: "array", label: "Array" },
  { value: "null", label: "Null" },
  { value: "const", label: "Const" },
];

const MAX_DEPTH = 3;

const STRING_FORMATS = [
  { value: "email", label: "email" },
  { value: "url", label: "url" },
  { value: "uuid", label: "uuid" },
  { value: "date", label: "date" },
  { value: "date-time", label: "date-time" },
  { value: "time", label: "time" },
  { value: "ipv4", label: "ipv4" },
  { value: "ipv6", label: "ipv6" },
];

export interface EnumDatasetOption {
  id: string;
  key: string;
  name: string;
  source: "dataset";
}

interface ParameterRowProps {
  fieldPath: string;
  onDelete: () => void;
  enumDatasetOptions?: EnumDatasetOption[];
  enumDatasetValues?: Record<string, string[]>;
  /** Hide default value input (e.g. for return parameters). */
  hideDefault?: boolean;
  depth?: number;
  schemas?: SchemaRow[];
}

type EnumSource = "manual" | "ref";
type ObjectSource = "manual" | "ref" | "merge";

/** Nested properties — separated to avoid conditional useFieldArray calls. */
function NestedProperties({
  fieldPath,
  enumDatasetOptions,
  enumDatasetValues,
  hideDefault,
  depth,
  schemas,
}: {
  fieldPath: string;
  enumDatasetOptions: EnumDatasetOption[];
  enumDatasetValues: Record<string, string[]>;
  hideDefault: boolean;
  depth: number;
  schemas?: SchemaRow[];
}) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${fieldPath}.properties`,
  });

  return (
    <div className="border-l-2 border-muted pl-4 ml-2 space-y-1.5 min-w-0">
      {fields.map((field, index) => (
        <ParameterRow
          key={field.id}
          fieldPath={`${fieldPath}.properties.${index}`}
          onDelete={() => remove(index)}
          enumDatasetOptions={enumDatasetOptions}
          enumDatasetValues={enumDatasetValues}
          hideDefault={hideDefault}
          depth={depth + 1}
          schemas={schemas}
        />
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          append({
            id: nanoid(),
            name: "",
            type: "string",
            description: "",
            required: false,
          })
        }
        className="gap-1 text-xs h-7"
      >
        <PlusIcon className="size-3" />
        添加字段
      </Button>
    </div>
  );
}

/** additionalProperties toggle + value type selector for Map/Record on object type. */
function AdditionalPropertiesEditor({
  fieldPath,
  depth,
}: {
  fieldPath: string;
  depth: number;
}) {
  const { control, setValue, getValues } = useFormContext();
  const ap = useWatch({ control, name: `${fieldPath}.additionalProperties` }) as
    | { type?: SchemaPropertyType }
    | undefined;
  const enabled = ap != null;

  return (
    <div className="flex items-center gap-2 pl-[128px] min-w-0">
      <Switch
        size="sm"
        checked={enabled}
        onCheckedChange={(checked: boolean) => {
          if (checked) {
            setValue(`${fieldPath}.additionalProperties`, {
              id: nanoid(),
              name: "_value",
              type: "string",
              description: "",
              required: true,
            });
          } else {
            setValue(`${fieldPath}.additionalProperties`, undefined);
          }
        }}
      />
      <span className="text-xs text-muted-foreground shrink-0">动态 Key</span>
      {enabled && (
        <Controller
          name={`${fieldPath}.additionalProperties.type`}
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? "string"}
              onValueChange={(value: SchemaPropertyType) => {
                setValue(`${fieldPath}.additionalProperties`, {
                  id: getValues(`${fieldPath}.additionalProperties.id`) || nanoid(),
                  name: "_value",
                  type: value,
                  description: "",
                  required: true,
                });
              }}
            >
              <SelectTrigger className="w-[100px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAP_VALUE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}
    </div>
  );
}

/** Union variant editor — each variant is a SchemaProperty with its own type. */
function UnionVariants({
  fieldPath,
  enumDatasetOptions,
  enumDatasetValues,
  hideDefault,
  depth,
  schemas,
}: {
  fieldPath: string;
  enumDatasetOptions: EnumDatasetOption[];
  enumDatasetValues: Record<string, string[]>;
  hideDefault: boolean;
  depth: number;
  schemas?: SchemaRow[];
}) {
  const { control, register, setValue } = useFormContext();
  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
    control,
    name: `${fieldPath}.variants`,
  });
  const discriminator = useWatch({ control, name: `${fieldPath}.discriminator` }) as string | undefined;
  const unionMode = useWatch({ control, name: `${fieldPath}.unionMode` }) as string | undefined;
  const showDiscriminatorValue = !!discriminator && unionMode !== "anyOf";
  const hasDiscriminator = !!discriminator;

  return (
    <div className="border-l-2 border-muted pl-4 ml-2 space-y-3 min-w-0">
      {variantFields.map((vf, vIndex) => (
        <UnionVariantRow
          key={vf.id}
          fieldPath={fieldPath}
          vIndex={vIndex}
          showDiscriminatorValue={showDiscriminatorValue}
          hasDiscriminator={hasDiscriminator}
          discriminator={discriminator}
          onRemove={() => removeVariant(vIndex)}
          enumDatasetOptions={enumDatasetOptions}
          enumDatasetValues={enumDatasetValues}
          hideDefault={hideDefault}
          depth={depth}
          schemas={schemas}
          register={register}
          control={control}
          setValue={setValue}
        />
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => appendVariant({
          id: nanoid(),
          name: "",
          type: "string" as const,
          description: "",
          required: true,
        })}
        className="gap-1 text-xs h-7"
      >
        <PlusIcon className="size-3" />
        添加变体
      </Button>
    </div>
  );
}

/** Single union variant row — watches its own type to conditionally render sub-editors. */
function UnionVariantRow({
  fieldPath,
  vIndex,
  showDiscriminatorValue,
  hasDiscriminator,
  discriminator,
  onRemove,
  enumDatasetOptions,
  enumDatasetValues,
  hideDefault,
  depth,
  schemas,
  register,
  control,
  setValue,
}: {
  fieldPath: string;
  vIndex: number;
  showDiscriminatorValue: boolean;
  hasDiscriminator: boolean;
  discriminator?: string;
  onRemove: () => void;
  enumDatasetOptions: EnumDatasetOption[];
  enumDatasetValues: Record<string, string[]>;
  hideDefault: boolean;
  depth: number;
  schemas?: SchemaRow[];
  register: ReturnType<typeof useFormContext>["register"];
  control: ReturnType<typeof useFormContext>["control"];
  setValue: ReturnType<typeof useFormContext>["setValue"];
}) {
  const variantType = useWatch({ control, name: `${fieldPath}.variants.${vIndex}.type` }) as SchemaPropertyType | undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          变体 {vIndex + 1}
        </span>
        {showDiscriminatorValue && (
          <Input
            className="h-7 w-[120px] text-xs font-mono"
            {...register(`${fieldPath}.discriminatorValues.${vIndex}`)}
            placeholder={`${discriminator} 值`}
          />
        )}
        <Controller
          name={`${fieldPath}.variants.${vIndex}.type`}
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? "string"}
              onValueChange={(v: SchemaPropertyType) => {
                field.onChange(v);
                if (v !== "object") {
                  setValue(`${fieldPath}.variants.${vIndex}.properties`, undefined);
                }
                if (v !== "enum") {
                  setValue(`${fieldPath}.variants.${vIndex}.enum`, undefined);
                }
              }}
            >
              <SelectTrigger className="w-[100px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(hasDiscriminator ? UNION_VARIANT_TYPES.filter(t => t.value === "object") : UNION_VARIANT_TYPES)
                  .map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="size-6 p-0"
        >
          <Trash2Icon className="size-3" />
        </Button>
      </div>
      {/* Object variant: show nested properties editor */}
      {variantType === "object" && depth < MAX_DEPTH && (
        <NestedProperties
          fieldPath={`${fieldPath}.variants.${vIndex}`}
          enumDatasetOptions={enumDatasetOptions}
          enumDatasetValues={enumDatasetValues}
          hideDefault={hideDefault}
          depth={depth}
          schemas={schemas}
        />
      )}
      {/* Enum variant: show inline enum values editor */}
      {variantType === "enum" && (
        <div className="flex items-center gap-2 pl-4 min-w-0">
          <Controller
            name={`${fieldPath}.variants.${vIndex}.enum`}
            control={control}
            render={({ field }) => (
              <Input
                className="h-7 flex-1 text-xs"
                value={(field.value ?? []).join(", ")}
                onChange={(e) => {
                  const values = e.target.value
                    .split(",")
                    .map((v: string) => v.trim())
                    .filter(Boolean);
                  field.onChange(values.length > 0 ? values : undefined);
                }}
                placeholder="逗号分隔值，如 a, b, c"
              />
            )}
          />
        </div>
      )}
    </div>
  );
}

/** Tuple prefixItems editor — each position has its own type and constraints. */
function TuplePrefixItems({
  fieldPath,
  enumDatasetOptions,
  enumDatasetValues,
  hideDefault,
  depth,
  schemas,
}: {
  fieldPath: string;
  enumDatasetOptions: EnumDatasetOption[];
  enumDatasetValues: Record<string, string[]>;
  hideDefault: boolean;
  depth: number;
  schemas?: SchemaRow[];
}) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${fieldPath}.prefixItems`,
  });

  return (
    <div className="border-l-2 border-muted pl-4 ml-2 space-y-1.5 min-w-0">
      {fields.map((field, index) => (
        <div key={field.id} className="space-y-1">
          <span className="text-[10px] text-muted-foreground ml-1">
            [{index}]
          </span>
          <ParameterRow
            fieldPath={`${fieldPath}.prefixItems.${index}`}
            onDelete={() => remove(index)}
            enumDatasetOptions={enumDatasetOptions}
            enumDatasetValues={enumDatasetValues}
            hideDefault={hideDefault}
            depth={depth + 1}
            schemas={schemas}
          />
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          append({
            id: nanoid(),
            name: `item${fields.length}`,
            type: "string",
            description: "",
            required: true,
          })
        }
        className="gap-1 text-xs h-7"
      >
        <PlusIcon className="size-3" />
        添加位置
      </Button>
    </div>
  );
}

/** Union editor: unionMode switch + discriminator + variants. */
function UnionEditor({
  fieldPath,
  enumDatasetOptions,
  enumDatasetValues,
  hideDefault,
  depth,
  schemas,
}: {
  fieldPath: string;
  enumDatasetOptions: EnumDatasetOption[];
  enumDatasetValues: Record<string, string[]>;
  hideDefault: boolean;
  depth: number;
  schemas?: SchemaRow[];
}) {
  const { register, control, setValue } = useFormContext();
  const unionMode = useWatch({ control, name: `${fieldPath}.unionMode` }) as string | undefined;
  const variants = useWatch({ control, name: `${fieldPath}.variants` }) as
    | { type?: string }[]
    | undefined;
  const isAnyOf = unionMode === "anyOf";

  // Discriminator only makes sense when ALL variants are object type
  const allVariantsAreObjects =
    !variants ||
    variants.length === 0 ||
    variants.every((v) => v?.type === "object");
  const showDiscriminator = !isAnyOf && allVariantsAreObjects;

  // Auto-clear discriminator data when it should be hidden
  useEffect(() => {
    if (!showDiscriminator) {
      setValue(`${fieldPath}.discriminator`, undefined);
      setValue(`${fieldPath}.discriminatorValues`, undefined);
    }
  }, [showDiscriminator, fieldPath, setValue]);

  return (
    <>
      <div className="flex items-center gap-2 pl-[128px] min-w-0">
        <span className="text-xs text-muted-foreground shrink-0">匹配规则</span>
        <Controller
          name={`${fieldPath}.unionMode`}
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? "oneOf"}
              onValueChange={(value: string) => {
                field.onChange(value === "oneOf" ? undefined : value);
                if (value === "anyOf") {
                  setValue(`${fieldPath}.discriminator`, undefined);
                  setValue(`${fieldPath}.discriminatorValues`, undefined);
                }
              }}
            >
              <SelectTrigger className="w-[160px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oneOf">恰好一个 (oneOf)</SelectItem>
                <SelectItem value="anyOf">至少一个 (anyOf)</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
      {showDiscriminator && (
        <div className="flex items-center gap-2 pl-[128px] min-w-0">
          <span className="text-xs text-muted-foreground shrink-0">判别字段</span>
          <Input
            className="h-8 w-[160px] text-sm"
            {...register(`${fieldPath}.discriminator`)}
            placeholder="如 type（可选）"
          />
          <span className="text-xs text-muted-foreground/60 shrink-0">仅全部变体为 Object 时可用</span>
        </div>
      )}
      <UnionVariants
        fieldPath={fieldPath}
        enumDatasetOptions={enumDatasetOptions}
        enumDatasetValues={enumDatasetValues}
        hideDefault={hideDefault}
        depth={depth}
        schemas={schemas}
      />
    </>
  );
}

/** Only re-renders when `required` changes. */
function RequiredLabel({ fieldPath }: { fieldPath: string }) {
  const { control } = useFormContext();
  const required = useWatch({ control, name: `${fieldPath}.required` }) as boolean;
  return (
    <span className="text-[10px] text-muted-foreground w-8">
      {required ? "req" : "opt"}
    </span>
  );
}

function NullableLabel({ fieldPath }: { fieldPath: string }) {
  const { control } = useFormContext();
  const nullable = useWatch({ control, name: `${fieldPath}.nullable` }) as boolean | undefined;
  return (
    <span className="text-[10px] text-muted-foreground w-8">
      {nullable ? "T|null" : "T"}
    </span>
  );
}

/** Only re-renders when `defaultValue` changes (for icon highlight). */
function DefaultValueToggleButton({
  fieldPath,
  onClick,
}: {
  fieldPath: string;
  onClick: () => void;
}) {
  const { control } = useFormContext();
  const defaultValue = useWatch({ control, name: `${fieldPath}.defaultValue` });
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`size-8 p-0 ${defaultValue != null ? "text-foreground" : "text-muted-foreground/50"}`}
    >
      <BracesIcon className="size-3.5" />
    </Button>
  );
}

/** Constraint fields per type — used to detect "has any constraint". */
const CONSTRAINT_KEYS: Record<string, string[]> = {
  string: ["minLength", "maxLength", "pattern", "format"],
  number: ["integer", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"],
  array: ["minItems", "maxItems", "uniqueItems"],
};

/** Only re-renders when constraint-related fields change (for icon highlight). */
function ConstraintsToggleButton({
  fieldPath,
  type,
  onClick,
}: {
  fieldPath: string;
  type: SchemaPropertyType;
  onClick: () => void;
}) {
  const { control } = useFormContext();
  const keys = CONSTRAINT_KEYS[type] ?? [];
  const watched = useWatch({
    control,
    name: keys.map((k) => `${fieldPath}.${k}`),
  });
  const hasConstraints = (watched as unknown[]).some((v) => v != null && v !== false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`size-8 p-0 ${hasConstraints ? "text-foreground" : "text-muted-foreground/50"}`}
    >
      <SlidersHorizontalIcon className="size-3.5" />
    </Button>
  );
}

/** Type-specific default value editor — watches its own fields. */
function DefaultValueEditor({
  type,
  fieldPath,
  enumDatasetValues,
}: {
  type: SchemaPropertyType;
  fieldPath: string;
  enumDatasetValues: Record<string, string[]>;
}) {
  const { control, setValue } = useFormContext();
  const defaultValue = useWatch({ control, name: `${fieldPath}.defaultValue` });
  const enumValues = useWatch({ control, name: `${fieldPath}.enum` }) as string[] | undefined;
  const enumDatasetId = useWatch({ control, name: `${fieldPath}.enumDatasetId` }) as string | undefined;

  // Resolve available options for enum type
  const options =
    enumDatasetId && enumDatasetValues[enumDatasetId]
      ? enumDatasetValues[enumDatasetId]
      : enumValues ?? [];

  if (type === "boolean") {
    return (
      <div className="flex items-center gap-2 pl-[128px]">
        <label className="text-xs text-muted-foreground shrink-0">默认值</label>
        <Switch
          size="sm"
          checked={defaultValue === true}
          onCheckedChange={(checked: boolean) =>
            setValue(`${fieldPath}.defaultValue`, checked)
          }
        />
        <span className="text-xs text-muted-foreground">
          {defaultValue === true ? "true" : "false"}
        </span>
      </div>
    );
  }

  if (type === "enum") {
    return (
      <div className="flex items-center gap-2 pl-[128px]">
        <label className="text-xs text-muted-foreground shrink-0">默认值</label>
        <Select
          value={defaultValue != null ? String(defaultValue) : ""}
          onValueChange={(value: string) =>
            setValue(`${fieldPath}.defaultValue`, value || undefined)
          }
        >
          <SelectTrigger className="flex-1" size="sm">
            <SelectValue placeholder="选择默认值..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
            {options.length === 0 && (
              <SelectItem value="__empty__" disabled>
                请先定义枚举值
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (type === "object" || type === "array") {
    return (
      <div className="pl-[128px] space-y-1">
        <label className="text-xs text-muted-foreground">默认值</label>
        <JsonEditor
          value={defaultValue != null ? JSON.stringify(defaultValue, null, 2) : ""}
          onChange={(raw) => {
            if (!raw?.trim()) {
              setValue(`${fieldPath}.defaultValue`, undefined);
            } else {
              try {
                setValue(`${fieldPath}.defaultValue`, JSON.parse(raw));
              } catch {
                // keep raw string while user is still typing
              }
            }
          }}
          height="100px"
        />
      </div>
    );
  }

  // string / number — plain input
  return (
    <div className="flex items-center gap-2 pl-[128px]">
      <label className="text-xs text-muted-foreground shrink-0">默认值</label>
      <Input
        className="h-8 flex-1 text-xs font-mono"
        type={type === "number" ? "number" : "text"}
        value={defaultValue != null ? String(defaultValue) : ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            setValue(`${fieldPath}.defaultValue`, undefined);
          } else if (type === "number") {
            const num = Number(raw);
            setValue(`${fieldPath}.defaultValue`, isNaN(num) ? raw : num);
          } else {
            setValue(`${fieldPath}.defaultValue`, raw);
          }
        }}
        placeholder={type === "number" ? "0" : "default value"}
      />
    </div>
  );
}

/** Schema merge editor — multi-select schemas with merged preview. */
function SchemaMergeEditor({
  fieldPath,
  schemas,
}: {
  fieldPath: string;
  schemas: SchemaRow[];
}) {
  const { control, setValue } = useFormContext();
  const selectedIds = (useWatch({ control, name: `${fieldPath}.schemaIds` }) as string[] | undefined) ?? [];

  const toggleSchema = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((s) => s !== id)
      : [...selectedIds, id];
    setValue(`${fieldPath}.schemaIds`, next.length > 0 ? next : undefined);
  };

  // Compute merged preview
  const mergedParams: { name: string; type: string; required: boolean; source: string }[] = [];
  const seen = new Set<string>();
  for (const sid of selectedIds) {
    const schema = schemas.find((s) => s.id === sid);
    if (!schema) continue;
    for (const p of schema.parameters) {
      if (seen.has(p.name)) {
        const idx = mergedParams.findIndex((m) => m.name === p.name);
        if (idx >= 0) mergedParams[idx] = { name: p.name, type: p.type, required: p.required, source: schema.name };
      } else {
        seen.add(p.name);
        mergedParams.push({ name: p.name, type: p.type, required: p.required, source: schema.name });
      }
    }
  }

  return (
    <div className="pl-[128px] space-y-2 min-w-0">
      <div className="space-y-1">
        {schemas.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox
              checked={selectedIds.includes(s.id)}
              onCheckedChange={() => toggleSchema(s.id)}
            />
            {s.name}
          </label>
        ))}
      </div>
      {mergedParams.length > 0 && (
        <div className="border-l-2 border-muted pl-4 ml-2 space-y-0.5">
          <span className="text-[10px] text-muted-foreground">合并预览</span>
          {mergedParams.map((p) => (
            <div key={p.name} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{p.name}</span>
              <span>{p.type}</span>
              {p.required && <span className="text-orange-500 text-[10px]">req</span>}
              <span className="text-[10px] opacity-60">← {p.source}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Read-only preview of schema parameters for object ref mode. */
function SchemaRefPreview({ schemas, schemaId }: { schemas: SchemaRow[]; schemaId: string }) {
  const schema = schemas.find((s) => s.id === schemaId);
  if (!schema || schema.parameters.length === 0) return null;

  return (
    <div className="border-l-2 border-muted pl-4 ml-2 space-y-0.5">
      {schema.parameters.map((p) => (
        <div key={p.id} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{p.name}</span>
          <span>{p.type}</span>
          {p.required && <span className="text-orange-500 text-[10px]">req</span>}
        </div>
      ))}
    </div>
  );
}

export function ParameterRow({
  fieldPath,
  onDelete,
  enumDatasetOptions = [],
  enumDatasetValues = {},
  hideDefault = false,
  depth = 0,
  schemas = [],
}: ParameterRowProps) {
  const { register, control, setValue, getValues } = useFormContext();

  // Only watch fields needed for conditional rendering in this component
  const type = useWatch({ control, name: `${fieldPath}.type` }) as SchemaPropertyType;
  const enumDatasetId = useWatch({ control, name: `${fieldPath}.enumDatasetId` }) as string | undefined;
  const schemaId = useWatch({ control, name: `${fieldPath}.schemaId` }) as string | undefined;
  const itemsType = useWatch({ control, name: `${fieldPath}.items.type` }) as SchemaPropertyType | undefined;
  const isTuple = useWatch({ control, name: `${fieldPath}.tuple` }) as boolean | undefined;

  const isString = type === "string";
  const isNumber = type === "number";
  const isEnum = type === "enum";
  const isObject = type === "object";
  const isArray = type === "array";
  const isUnion = type === "union";
  const isConst = type === "const";
  const canNestObject = isObject && depth < MAX_DEPTH;
  const canNestArrayItems = isArray && depth < MAX_DEPTH;
  const canNestUnion = isUnion && depth < MAX_DEPTH;

  const [enumSource, setEnumSource] = useState<EnumSource>(() =>
    enumDatasetId ? "ref" : "manual"
  );
  const schemaIds = useWatch({ control, name: `${fieldPath}.schemaIds` }) as string[] | undefined;
  const [objectSource, setObjectSource] = useState<ObjectSource>(() =>
    schemaIds && schemaIds.length > 0 ? "merge" : schemaId ? "ref" : "manual"
  );
  // Read initial defaultValue once (no subscription) to set initial expand state
  const [showDefault, setShowDefault] = useState(
    () => getValues(`${fieldPath}.defaultValue`) != null
  );
  // Read initial constraints once to set initial expand state
  const [showConstraints, setShowConstraints] = useState(() => {
    const keys = CONSTRAINT_KEYS[type] ?? [];
    const values = getValues(fieldPath) as Record<string, unknown> | undefined;
    return keys.some((k) => values?.[k] != null && values[k] !== false);
  });

  const hasSchemas = schemas.length > 0;

  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <Input
          className="h-8 w-[120px] text-sm"
          {...register(`${fieldPath}.name`)}
          placeholder="name"
        />
        <Controller
          name={`${fieldPath}.type`}
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value: SchemaPropertyType) => {
                field.onChange(value);
                if (value !== "enum") {
                  setValue(`${fieldPath}.enum`, undefined);
                  setValue(`${fieldPath}.enumDatasetId`, undefined);
                }
                if (value !== "object") {
                  setValue(`${fieldPath}.properties`, undefined);
                  setValue(`${fieldPath}.schemaId`, undefined);
                  setValue(`${fieldPath}.schemaIds`, undefined);
                  setValue(`${fieldPath}.additionalProperties`, undefined);
                }
                if (value !== "array") {
                  setValue(`${fieldPath}.items`, undefined);
                  setValue(`${fieldPath}.tuple`, undefined);
                  setValue(`${fieldPath}.prefixItems`, undefined);
                }
                if (value !== "union") {
                  setValue(`${fieldPath}.discriminator`, undefined);
                  setValue(`${fieldPath}.discriminatorValues`, undefined);
                  setValue(`${fieldPath}.variants`, undefined);
                  setValue(`${fieldPath}.unionMode`, undefined);
                }
                if (value !== "const") {
                  setValue(`${fieldPath}.constValue`, undefined);
                }
              }}
            >
              <SelectTrigger className="w-[100px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARAM_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <Input
          className="h-8 flex-1 text-sm"
          {...register(`${fieldPath}.description`)}
          placeholder="description"
        />
        {!hideDefault && (
          <DefaultValueToggleButton
            fieldPath={fieldPath}
            onClick={() => setShowDefault((v) => !v)}
          />
        )}
        {(isString || isNumber || isArray) && (
          <ConstraintsToggleButton
            fieldPath={fieldPath}
            type={type}
            onClick={() => setShowConstraints((v) => !v)}
          />
        )}
        <div className="flex items-center gap-1">
          <Controller
            name={`${fieldPath}.required`}
            control={control}
            render={({ field }) => (
              <Switch
                size="sm"
                checked={field.value}
                onCheckedChange={(checked: boolean) => field.onChange(checked)}
              />
            )}
          />
          <RequiredLabel fieldPath={fieldPath} />
        </div>
        {type !== "null" && (
          <div className="flex items-center gap-1">
            <Controller
              name={`${fieldPath}.nullable`}
              control={control}
              render={({ field }) => (
                <Switch
                  size="sm"
                  checked={field.value ?? false}
                  onCheckedChange={(checked: boolean) => field.onChange(checked || undefined)}
                />
              )}
            />
            <NullableLabel fieldPath={fieldPath} />
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="size-8 p-0"
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </div>

      {!hideDefault && showDefault && (
        <DefaultValueEditor
          type={type}
          fieldPath={fieldPath}
          enumDatasetValues={enumDatasetValues}
        />
      )}

      {isEnum && (
        <div className="flex items-center gap-2 pl-[128px] min-w-0">
          <Select
            value={enumSource}
            onValueChange={(value: EnumSource) => {
              setEnumSource(value);
              if (value === "manual") {
                setValue(`${fieldPath}.enumDatasetId`, undefined);
              } else {
                setValue(`${fieldPath}.enum`, undefined);
              }
            }}
          >
            <SelectTrigger className="w-[80px]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">手动</SelectItem>
              <SelectItem value="ref">引用</SelectItem>
            </SelectContent>
          </Select>

          {enumSource === "manual" ? (
            <Controller
              name={`${fieldPath}.enum`}
              control={control}
              render={({ field }) => (
                <Input
                  className="h-8 flex-1 text-sm"
                  value={(field.value ?? []).join(", ")}
                  onChange={(e) => {
                    const values = e.target.value
                      .split(",")
                      .map((v: string) => v.trim())
                      .filter(Boolean);
                    field.onChange(values.length > 0 ? values : undefined);
                  }}
                  placeholder="逗号分隔值，如 CA, NY, TX"
                />
              )}
            />
          ) : (
            <div className="flex-1 min-w-0 space-y-1">
              <Controller
                name={`${fieldPath}.enumDatasetId`}
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(value: string) => {
                      field.onChange(value || undefined);
                    }}
                  >
                    <SelectTrigger className="w-full" size="sm">
                      <SelectValue placeholder="选择引用..." />
                    </SelectTrigger>
                    <SelectContent>
                      {enumDatasetOptions.length > 0 ? (
                        enumDatasetOptions.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            <span className="mr-1.5 text-[10px] text-muted-foreground">
                              [数据集]
                            </span>
                            {o.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__empty__" disabled>
                          无可用的码表或变量
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {enumDatasetId && enumDatasetValues[enumDatasetId] && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {enumDatasetValues[enumDatasetId].join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Const value editor */}
      {isConst && (
        <div className="flex items-center gap-2 pl-[128px] min-w-0">
          <span className="text-xs text-muted-foreground shrink-0">固定值</span>
          <Controller
            name={`${fieldPath}.constValue`}
            control={control}
            render={({ field }) => (
              <Input
                className="h-8 flex-1 text-xs font-mono"
                value={field.value != null ? String(field.value) : ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    field.onChange(undefined);
                    return;
                  }
                  // Try parsing as JSON (number, boolean, null, string)
                  try {
                    field.onChange(JSON.parse(raw));
                  } catch {
                    field.onChange(raw);
                  }
                }}
                placeholder='值，如 "1.0" 或 42 或 true'
              />
            )}
          />
        </div>
      )}

      {/* String constraints */}
      {showConstraints && isString && (
        <div className="flex items-center gap-2 pl-[128px] min-w-0 flex-wrap">
          <span className="text-xs text-muted-foreground shrink-0">minLength</span>
          <Input
            className="h-8 w-[80px] text-xs font-mono"
            type="number"
            placeholder="0"
            {...register(`${fieldPath}.minLength`, { setValueAs: (v: string) => v === "" ? undefined : Number(v) })}
          />
          <span className="text-xs text-muted-foreground shrink-0">maxLength</span>
          <Input
            className="h-8 w-[80px] text-xs font-mono"
            type="number"
            placeholder="∞"
            {...register(`${fieldPath}.maxLength`, { setValueAs: (v: string) => v === "" ? undefined : Number(v) })}
          />
          <span className="text-xs text-muted-foreground shrink-0">pattern</span>
          <Input
            className="h-8 flex-1 text-xs font-mono"
            placeholder="^[a-z]+$"
            {...register(`${fieldPath}.pattern`, { setValueAs: (v: string) => v === "" ? undefined : v })}
          />
          <span className="text-xs text-muted-foreground shrink-0">format</span>
          <Controller
            name={`${fieldPath}.format`}
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? "__none__"}
                onValueChange={(value) => {
                  field.onChange(value === "__none__" ? undefined : value);
                }}
              >
                <SelectTrigger className="w-[120px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">无</SelectItem>
                  {STRING_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {/* Number constraints */}
      {showConstraints && isNumber && (
        <div className="flex items-center gap-2 pl-[128px] min-w-0 flex-wrap">
          <Controller
            name={`${fieldPath}.integer`}
            control={control}
            render={({ field }) => (
              <Switch
                size="sm"
                checked={field.value ?? false}
                onCheckedChange={(checked: boolean) => {
                  field.onChange(checked || undefined);
                }}
              />
            )}
          />
          <span className="text-xs text-muted-foreground shrink-0">integer</span>
          <span className="text-xs text-muted-foreground shrink-0">min</span>
          <Input
            className="h-8 w-[80px] text-xs font-mono"
            type="number"
            placeholder="-∞"
            {...register(`${fieldPath}.minimum`, { setValueAs: (v: string) => v === "" ? undefined : Number(v) })}
          />
          <span className="text-xs text-muted-foreground shrink-0">max</span>
          <Input
            className="h-8 w-[80px] text-xs font-mono"
            type="number"
            placeholder="∞"
            {...register(`${fieldPath}.maximum`, { setValueAs: (v: string) => v === "" ? undefined : Number(v) })}
          />
          <span className="text-xs text-muted-foreground shrink-0">excl.min</span>
          <Input
            className="h-8 w-[80px] text-xs font-mono"
            type="number"
            {...register(`${fieldPath}.exclusiveMinimum`, { setValueAs: (v: string) => v === "" ? undefined : Number(v) })}
          />
          <span className="text-xs text-muted-foreground shrink-0">excl.max</span>
          <Input
            className="h-8 w-[80px] text-xs font-mono"
            type="number"
            {...register(`${fieldPath}.exclusiveMaximum`, { setValueAs: (v: string) => v === "" ? undefined : Number(v) })}
          />
          <span className="text-xs text-muted-foreground shrink-0">multipleOf</span>
          <Input
            className="h-8 w-[80px] text-xs font-mono"
            type="number"
            {...register(`${fieldPath}.multipleOf`, { setValueAs: (v: string) => v === "" ? undefined : Number(v) })}
          />
        </div>
      )}

      {/* Array: mode switch (items vs tuple) */}
      {canNestArrayItems && (
        <div className="flex items-center gap-2 pl-[128px] min-w-0">
          <span className="text-xs text-muted-foreground shrink-0">模式</span>
          <Controller
            name={`${fieldPath}.tuple`}
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ? "tuple" : "items"}
                onValueChange={(value: string) => {
                  const isTupleMode = value === "tuple";
                  field.onChange(isTupleMode || undefined);
                  if (isTupleMode) {
                    setValue(`${fieldPath}.items`, undefined);
                    setValue(`${fieldPath}.minItems`, undefined);
                    setValue(`${fieldPath}.maxItems`, undefined);
                    setValue(`${fieldPath}.uniqueItems`, undefined);
                    if (!getValues(`${fieldPath}.prefixItems`)?.length) {
                      setValue(`${fieldPath}.prefixItems`, [{
                        id: nanoid(),
                        name: "item0",
                        type: "string",
                        description: "",
                        required: true,
                      }]);
                    }
                  } else {
                    setValue(`${fieldPath}.prefixItems`, undefined);
                  }
                }}
              >
                <SelectTrigger className="w-[180px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="items">同类型元素 (items)</SelectItem>
                  <SelectItem value="tuple">固定位置 (tuple)</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {/* Array items mode: type selector + constraints */}
      {canNestArrayItems && !isTuple && (
        <>
          <div className="flex items-center gap-2 pl-[128px] min-w-0">
            <span className="text-xs text-muted-foreground shrink-0">元素类型</span>
            <Controller
              name={`${fieldPath}.items.type`}
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? "string"}
                  onValueChange={(value: SchemaPropertyType) => {
                    setValue(`${fieldPath}.items`, {
                      id: getValues(`${fieldPath}.items.id`) || nanoid(),
                      name: "item",
                      type: value,
                      description: "",
                      required: true,
                    });
                  }}
                >
                  <SelectTrigger className="w-[100px]" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARRAY_ITEM_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {showConstraints && <div className="flex items-center gap-2 pl-[128px] min-w-0">
            <span className="text-xs text-muted-foreground shrink-0">minItems</span>
            <Input
              className="h-8 w-[80px] text-xs font-mono"
              type="number"
              placeholder="0"
              {...register(`${fieldPath}.minItems`, { setValueAs: (v: string) => v === "" ? undefined : Number(v) })}
            />
            <span className="text-xs text-muted-foreground shrink-0">maxItems</span>
            <Input
              className="h-8 w-[80px] text-xs font-mono"
              type="number"
              placeholder="∞"
              {...register(`${fieldPath}.maxItems`, { setValueAs: (v: string) => v === "" ? undefined : Number(v) })}
            />
            <Controller
              name={`${fieldPath}.uniqueItems`}
              control={control}
              render={({ field }) => (
                <Switch
                  size="sm"
                  checked={field.value ?? false}
                  onCheckedChange={(checked: boolean) => {
                    field.onChange(checked || undefined);
                  }}
                />
              )}
            />
            <span className="text-xs text-muted-foreground shrink-0">uniqueItems</span>
          </div>}
        </>
      )}

      {/* Array items mode: object nested properties */}
      {canNestArrayItems && !isTuple && itemsType === "object" && (
        <NestedProperties
          fieldPath={`${fieldPath}.items`}
          enumDatasetOptions={enumDatasetOptions}
          enumDatasetValues={enumDatasetValues}
          hideDefault={hideDefault}
          depth={depth + 1}
          schemas={schemas}
        />
      )}

      {/* Array tuple mode: prefixItems editor */}
      {canNestArrayItems && isTuple && (
        <TuplePrefixItems
          fieldPath={fieldPath}
          enumDatasetOptions={enumDatasetOptions}
          enumDatasetValues={enumDatasetValues}
          hideDefault={hideDefault}
          depth={depth}
          schemas={schemas}
        />
      )}

      {/* Object: source selector (manual / ref / merge) */}
      {canNestObject && hasSchemas && (
        <div className="flex items-center gap-2 pl-[128px] min-w-0">
          <Select
            value={objectSource}
            onValueChange={(value: ObjectSource) => {
              setObjectSource(value);
              if (value === "manual") {
                setValue(`${fieldPath}.schemaId`, undefined);
                setValue(`${fieldPath}.schemaIds`, undefined);
              } else if (value === "ref") {
                setValue(`${fieldPath}.properties`, undefined);
                setValue(`${fieldPath}.schemaIds`, undefined);
              } else {
                // merge
                setValue(`${fieldPath}.properties`, undefined);
                setValue(`${fieldPath}.schemaId`, undefined);
              }
            }}
          >
            <SelectTrigger className="w-[80px]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">手动</SelectItem>
              <SelectItem value="ref">引用</SelectItem>
              <SelectItem value="merge">合并</SelectItem>
            </SelectContent>
          </Select>

          {objectSource === "ref" && (
            <Controller
              name={`${fieldPath}.schemaId`}
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(value: string) =>
                    field.onChange(value || undefined)
                  }
                >
                  <SelectTrigger className="flex-1" size="sm">
                    <SelectValue placeholder="选择 Schema..." />
                  </SelectTrigger>
                  <SelectContent>
                    {schemas.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </div>
      )}

      {/* Object merge mode: multi-select schemas */}
      {canNestObject && objectSource === "merge" && (
        <SchemaMergeEditor fieldPath={fieldPath} schemas={schemas} />
      )}

      {/* Object ref preview */}
      {canNestObject && objectSource === "ref" && schemaId && (
        <SchemaRefPreview schemas={schemas} schemaId={schemaId} />
      )}

      {/* Object manual nested properties */}
      {canNestObject && objectSource === "manual" && (
        <NestedProperties
          fieldPath={fieldPath}
          enumDatasetOptions={enumDatasetOptions}
          enumDatasetValues={enumDatasetValues}
          hideDefault={hideDefault}
          depth={depth}
          schemas={schemas}
        />
      )}

      {/* Object without schemas: always show nested properties */}
      {canNestObject && !hasSchemas && (
        <NestedProperties
          fieldPath={fieldPath}
          enumDatasetOptions={enumDatasetOptions}
          enumDatasetValues={enumDatasetValues}
          hideDefault={hideDefault}
          depth={depth}
        />
      )}

      {/* Object: additionalProperties (Map/Record value type) */}
      {canNestObject && (
        <AdditionalPropertiesEditor
          fieldPath={fieldPath}
          depth={depth}
        />
      )}

      {/* Union: unionMode + discriminator + variants */}
      {canNestUnion && (
        <UnionEditor
          fieldPath={fieldPath}
          enumDatasetOptions={enumDatasetOptions}
          enumDatasetValues={enumDatasetValues}
          hideDefault={hideDefault}
          depth={depth}
          schemas={schemas}
        />
      )}
    </div>
  );
}
