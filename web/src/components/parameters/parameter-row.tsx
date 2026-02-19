"use client";

import { Button } from "@/components/ui/button";
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
import { BracesIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
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
type ObjectSource = "manual" | "ref";

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

/** Union variant editor — each variant is a list of properties (like an object). */
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
  const { control, setValue, getValues } = useFormContext();
  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
    control,
    name: `${fieldPath}.variants`,
  });

  return (
    <div className="border-l-2 border-muted pl-4 ml-2 space-y-3 min-w-0">
      {variantFields.map((vf, vIndex) => (
        <div key={vf.id} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              变体 {vIndex + 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeVariant(vIndex)}
              className="size-6 p-0"
            >
              <Trash2Icon className="size-3" />
            </Button>
          </div>
          <NestedPropertiesForVariant
            fieldPath={`${fieldPath}.variants.${vIndex}`}
            enumDatasetOptions={enumDatasetOptions}
            enumDatasetValues={enumDatasetValues}
            hideDefault={hideDefault}
            depth={depth}
            schemas={schemas}
          />
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => appendVariant([{
          id: nanoid(),
          name: "",
          type: "string" as const,
          description: "",
          required: false,
        }])}
        className="gap-1 text-xs h-7"
      >
        <PlusIcon className="size-3" />
        添加变体
      </Button>
    </div>
  );
}

/**
 * Variant-level nested properties editor.
 * Variants are stored as SchemaProperty[][] — each variant is an array of properties.
 * The fieldPath points to `variants.N` which is an array.
 */
function NestedPropertiesForVariant({
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
    name: fieldPath,
  });

  return (
    <div className="border-l-2 border-muted/50 pl-3 ml-1 space-y-1.5 min-w-0">
      {fields.map((field, index) => (
        <ParameterRow
          key={field.id}
          fieldPath={`${fieldPath}.${index}`}
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

  const isString = type === "string";
  const isNumber = type === "number";
  const isEnum = type === "enum";
  const isObject = type === "object";
  const isArray = type === "array";
  const isUnion = type === "union";
  const canNestObject = isObject && depth < MAX_DEPTH;
  const canNestArrayItems = isArray && depth < MAX_DEPTH;
  const canNestUnion = isUnion && depth < MAX_DEPTH;

  const [enumSource, setEnumSource] = useState<EnumSource>(() =>
    enumDatasetId ? "ref" : "manual"
  );
  const [objectSource, setObjectSource] = useState<ObjectSource>(() =>
    schemaId ? "ref" : "manual"
  );
  // Read initial defaultValue once (no subscription) to set initial expand state
  const [showDefault, setShowDefault] = useState(
    () => getValues(`${fieldPath}.defaultValue`) != null
  );

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
                  setValue(`${fieldPath}.additionalProperties`, undefined);
                }
                if (value !== "array") {
                  setValue(`${fieldPath}.items`, undefined);
                }
                if (value !== "union") {
                  setValue(`${fieldPath}.discriminator`, undefined);
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

      {/* String constraints */}
      {isString && (
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
      {isNumber && (
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

      {/* Array: items type selector */}
      {canNestArrayItems && (
        <div className="flex items-center gap-2 pl-[128px] min-w-0">
          <span className="text-xs text-muted-foreground shrink-0">元素类型</span>
          <Controller
            name={`${fieldPath}.items.type`}
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? "string"}
                onValueChange={(value: SchemaPropertyType) => {
                  // Reset items to a minimal object with the new type
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
      )}

      {/* Array constraints */}
      {canNestArrayItems && (
        <div className="flex items-center gap-2 pl-[128px] min-w-0">
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
        </div>
      )}

      {/* Array items: object nested properties */}
      {canNestArrayItems && itemsType === "object" && (
        <NestedProperties
          fieldPath={`${fieldPath}.items`}
          enumDatasetOptions={enumDatasetOptions}
          enumDatasetValues={enumDatasetValues}
          hideDefault={hideDefault}
          depth={depth + 1}
          schemas={schemas}
        />
      )}

      {/* Object: schema ref or manual properties */}
      {canNestObject && hasSchemas && (
        <div className="flex items-center gap-2 pl-[128px] min-w-0">
          <Select
            value={objectSource}
            onValueChange={(value: ObjectSource) => {
              setObjectSource(value);
              if (value === "manual") {
                setValue(`${fieldPath}.schemaId`, undefined);
              } else {
                setValue(`${fieldPath}.properties`, undefined);
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

      {/* Union: discriminator + variants */}
      {canNestUnion && (
        <>
          <div className="flex items-center gap-2 pl-[128px] min-w-0">
            <span className="text-xs text-muted-foreground shrink-0">判别字段</span>
            <Input
              className="h-8 w-[160px] text-sm"
              {...register(`${fieldPath}.discriminator`)}
              placeholder="type (可选)"
            />
          </div>
          <UnionVariants
            fieldPath={fieldPath}
            enumDatasetOptions={enumDatasetOptions}
            enumDatasetValues={enumDatasetValues}
            hideDefault={hideDefault}
            depth={depth}
            schemas={schemas}
          />
        </>
      )}
    </div>
  );
}
