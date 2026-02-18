"use client";

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
import type { ToolParameter, ToolParamType } from "@/lib/tools/types";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";

const PARAM_TYPES: { value: ToolParamType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "enum", label: "Enum" },
];

export interface EnumRefOption {
  key: string;
  source: "dataset";
}

interface ParameterRowProps {
  parameter: ToolParameter;
  onChange: (updated: ToolParameter) => void;
  onDelete: () => void;
  enumRefOptions?: EnumRefOption[];
  enumRefValues?: Record<string, string[]>;
}

type EnumSource = "manual" | "ref";

function detectEnumSource(param: ToolParameter): EnumSource {
  if (param.enumRef) return "ref";
  return "manual";
}

export function ParameterRow({
  parameter,
  onChange,
  onDelete,
  enumRefOptions = [],
  enumRefValues = {},
}: ParameterRowProps) {
  const isEnum = parameter.type === "enum";
  const [enumSource, setEnumSource] = useState<EnumSource>(() =>
    detectEnumSource(parameter)
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Input
          className="h-8 w-[120px] text-sm"
          value={parameter.name}
          onChange={(e) => onChange({ ...parameter, name: e.target.value })}
          placeholder="name"
        />
        <Select
          value={parameter.type}
          onValueChange={(value: ToolParamType) => {
            const updated: ToolParameter = { ...parameter, type: value };
            if (value !== "enum") {
              delete updated.enum;
              delete updated.enumRef;
            }
            onChange(updated);
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
        <Input
          className="h-8 flex-1 text-sm"
          value={parameter.description}
          onChange={(e) =>
            onChange({ ...parameter, description: e.target.value })
          }
          placeholder="description"
        />
        <div className="flex items-center gap-1">
          <Switch
            size="sm"
            checked={parameter.required}
            onCheckedChange={(checked: boolean) =>
              onChange({ ...parameter, required: checked })
            }
          />
          <span className="text-[10px] text-muted-foreground w-8">
            {parameter.required ? "req" : "opt"}
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
                onChange({ ...parameter, enumRef: undefined });
              } else {
                onChange({ ...parameter, enum: undefined });
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
            <Input
              className="h-8 flex-1 text-sm"
              value={(parameter.enum ?? []).join(", ")}
              onChange={(e) => {
                const values = e.target.value
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean);
                onChange({
                  ...parameter,
                  enum: values.length > 0 ? values : undefined,
                });
              }}
              placeholder="逗号分隔值，如 CA, NY, TX"
            />
          ) : (
            <div className="flex-1 space-y-1">
              <Select
                value={parameter.enumRef ?? ""}
                onValueChange={(value: string) => {
                  onChange({
                    ...parameter,
                    enumRef: value || undefined,
                  });
                }}
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
              {parameter.enumRef && enumRefValues[parameter.enumRef] && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {enumRefValues[parameter.enumRef].join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
