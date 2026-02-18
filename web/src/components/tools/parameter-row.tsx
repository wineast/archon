"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ToolParameter, ToolParamType } from "@/lib/tools/types";
import { EqualIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { nanoid } from "nanoid";

const PARAM_TYPES: { value: ToolParamType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "enum", label: "Enum" },
  { value: "json", label: "JSON" },
];

const MAX_DEPTH = 3;

export interface EnumRefOption {
  key: string;
  source: "dataset";
}

interface ParameterRowProps {
  fieldPath: string;
  onDelete: () => void;
  enumRefOptions?: EnumRefOption[];
  enumRefValues?: Record<string, string[]>;
  /** Hide default value input (e.g. for return parameters). */
  hideDefault?: boolean;
  depth?: number;
}

type EnumSource = "manual" | "ref";

/** Nested properties — separated to avoid conditional useFieldArray calls. */
function NestedProperties({
  fieldPath,
  enumRefOptions,
  enumRefValues,
  hideDefault,
  depth,
}: {
  fieldPath: string;
  enumRefOptions: EnumRefOption[];
  enumRefValues: Record<string, string[]>;
  hideDefault: boolean;
  depth: number;
}) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${fieldPath}.properties`,
  });

  return (
    <div className="border-l-2 border-muted pl-4 ml-2 space-y-1.5">
      {fields.map((field, index) => (
        <ParameterRow
          key={field.id}
          fieldPath={`${fieldPath}.properties.${index}`}
          onDelete={() => remove(index)}
          enumRefOptions={enumRefOptions}
          enumRefValues={enumRefValues}
          hideDefault={hideDefault}
          depth={depth + 1}
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

export function ParameterRow({
  fieldPath,
  onDelete,
  enumRefOptions = [],
  enumRefValues = {},
  hideDefault = false,
  depth = 0,
}: ParameterRowProps) {
  const { register, control, setValue } = useFormContext();

  // Only watch fields needed for conditional rendering
  const type = useWatch({ control, name: `${fieldPath}.type` }) as ToolParamType;
  const required = useWatch({ control, name: `${fieldPath}.required` }) as boolean;
  const defaultValue = useWatch({ control, name: `${fieldPath}.defaultValue` });
  const enumRef = useWatch({ control, name: `${fieldPath}.enumRef` }) as string | undefined;

  const isEnum = type === "enum";
  const isJson = type === "json";
  const canNest = isJson && depth < MAX_DEPTH;

  const [enumSource, setEnumSource] = useState<EnumSource>(() =>
    enumRef ? "ref" : "manual"
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
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
              onValueChange={(value: ToolParamType) => {
                field.onChange(value);
                if (value !== "enum") {
                  setValue(`${fieldPath}.enum`, undefined);
                  setValue(`${fieldPath}.enumRef`, undefined);
                }
                if (value !== "json") {
                  setValue(`${fieldPath}.properties`, undefined);
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
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`size-8 p-0 ${defaultValue != null ? "text-foreground" : "text-muted-foreground/50"}`}
              >
                <EqualIcon className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <label className="text-xs font-medium text-muted-foreground">
                Default Value
              </label>
              <Input
                className="mt-1.5 h-8 text-xs font-mono"
                value={defaultValue != null ? String(defaultValue) : ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setValue(`${fieldPath}.defaultValue`, undefined);
                  } else {
                    try {
                      setValue(`${fieldPath}.defaultValue`, JSON.parse(raw));
                    } catch {
                      setValue(`${fieldPath}.defaultValue`, raw);
                    }
                  }
                }}
                placeholder="default value"
                autoFocus
              />
            </PopoverContent>
          </Popover>
        )}
        <div className="flex items-center gap-1">
          <Controller
            name={`${fieldPath}.isArray`}
            control={control}
            render={({ field }) => (
              <Switch
                size="sm"
                checked={field.value ?? false}
                onCheckedChange={(checked: boolean) =>
                  field.onChange(checked || undefined)
                }
              />
            )}
          />
          <span className="text-[10px] text-muted-foreground w-4">[]</span>
        </div>
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
          <span className="text-[10px] text-muted-foreground w-8">
            {required ? "req" : "opt"}
          </span>
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

      {isEnum && (
        <div className="flex items-center gap-2 pl-[128px]">
          <Select
            value={enumSource}
            onValueChange={(value: EnumSource) => {
              setEnumSource(value);
              if (value === "manual") {
                setValue(`${fieldPath}.enumRef`, undefined);
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
            <div className="flex-1 space-y-1">
              <Controller
                name={`${fieldPath}.enumRef`}
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(value: string) =>
                      field.onChange(value || undefined)
                    }
                  >
                    <SelectTrigger className="w-full" size="sm">
                      <SelectValue placeholder="选择引用..." />
                    </SelectTrigger>
                    <SelectContent>
                      {enumRefOptions.length > 0 ? (
                        enumRefOptions.map((o) => (
                          <SelectItem key={o.key} value={o.key}>
                            <span className="mr-1.5 text-[10px] text-muted-foreground">
                              [数据集]
                            </span>
                            {o.key}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          无可用的码表或变量
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {enumRef && enumRefValues[enumRef] && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {enumRefValues[enumRef].join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {canNest && (
        <NestedProperties
          fieldPath={fieldPath}
          enumRefOptions={enumRefOptions}
          enumRefValues={enumRefValues}
          hideDefault={hideDefault}
          depth={depth}
        />
      )}
    </div>
  );
}
