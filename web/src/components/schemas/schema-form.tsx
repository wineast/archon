"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import deepEqual from "fast-deep-equal";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyField } from "@/components/ui/key-field";
import { Textarea } from "@/components/ui/textarea";
import { GuideDialog } from "@/components/ui/guide-dialog";
import { JsonEditor } from "@/components/editors/json-editor";
import { SchemaCodeAssistDialog } from "./schema-code-assist-dialog";
import type { JsonSchema7 } from "@/lib/schemas/types";
import { EMPTY_OBJECT_SCHEMA } from "@/lib/schemas/types";

export interface SchemaFormValues {
  key: string;
  name: string;
  description: string;
  parameters: JsonSchema7;
}

export interface SchemaFormHandle {
  getDraft: () => SchemaFormValues;
  isDirty: () => boolean;
  reset: () => void;
  /** Mark current form values as the new baseline (clears dirty state). */
  markClean: () => void;
}

interface SchemaFormProps {
  schema: SchemaFormValues;
  onDraftRef: (ref: SchemaFormHandle) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Rendered between metadata fields and Parameters section. */
  children?: React.ReactNode;
  /** When true, hide JSON editor (keeps form fields registered). */
  parametersHidden?: boolean;
  /** Context string for AI code assist (e.g. summary of all schemas). */
  context?: string;
  /** Dataset variable names for template autocompletion in JSON editor. */
  templateVariableNames?: string[];
}

const SCHEMA_GUIDE_CONTENT = `
# JSON Schema 编辑指南

## 基础结构

Schema 使用标准 JSON Schema 7 格式定义数据结构：

\`\`\`json
{
  "type": "object",
  "properties": {
    "name": { "type": "string", "description": "借款人姓名" },
    "age": { "type": "integer", "minimum": 18 }
  },
  "required": ["name", "age"]
}
\`\`\`

## 支持的类型

| 类型 | 示例 | Zod 映射 |
|------|------|---------|
| string | \`{ "type": "string" }\` | \`z.string()\` |
| integer | \`{ "type": "integer" }\` | \`z.number().int()\` |
| number | \`{ "type": "number" }\` | \`z.number()\` |
| boolean | \`{ "type": "boolean" }\` | \`z.boolean()\` |
| object | \`{ "type": "object", "properties": {...} }\` | \`z.object({...})\` |
| array | \`{ "type": "array", "items": {...} }\` | \`z.array(...)\` |
| null | \`{ "type": "null" }\` | \`z.null()\` |

## 枚举（Enum）

枚举是 string 类型的约束：

\`\`\`json
{ "type": "string", "enum": ["CA", "NY", "TX"] }
\`\`\`

## 模板字符串

在 enum 中使用数据集变量，运行时自动展开：

\`\`\`json
{ "enum": ["{{state_enum}}"] }
\`\`\`

## 引用其他 Schema（$ref）

通过 \`$ref\` 引用其他 Schema，实现复用：

\`\`\`json
{ "$ref": "#/$defs/address_fields" }
\`\`\`

格式为 \`#/$defs/{schema_key}\`，使用 Schema 的 key（snake_case）。

## 组合 Schema（allOf）

使用 \`allOf\` + \`$ref\` 合并多个 Schema：

\`\`\`json
{
  "allOf": [
    { "$ref": "#/$defs/contact_info" },
    { "$ref": "#/$defs/address_fields" }
  ],
  "type": "object",
  "properties": {
    "ssn_last4": { "type": "string" }
  }
}
\`\`\`

## 联合类型（Union）

使用 \`oneOf\` 或 \`anyOf\`：

\`\`\`json
{
  "oneOf": [
    { "type": "object", "properties": { "content": { "type": "string" } } },
    { "type": "object", "properties": { "url": { "type": "string" } } }
  ],
  "x-discriminator": "kind",
  "x-discriminatorValues": ["text", "image"]
}
\`\`\`

## Nullable

使用 \`anyOf\` 模式：

\`\`\`json
{ "anyOf": [{ "type": "string" }, { "type": "null" }] }
\`\`\`

## 字符串约束

| 约束 | 示例 |
|------|------|
| minLength | \`"minLength": 1\` |
| maxLength | \`"maxLength": 100\` |
| pattern | \`"pattern": "^\\\\d{5}$"\` |
| format | \`"format": "email"\` |

支持的 format：email, url, uuid, date, date-time, time, ipv4, ipv6

## 数值约束

| 约束 | 示例 |
|------|------|
| minimum | \`"minimum": 0\` |
| maximum | \`"maximum": 100\` |
| exclusiveMinimum | \`"exclusiveMinimum": 0\` |
| multipleOf | \`"multipleOf": 0.01\` |

## 数组

\`\`\`json
{
  "type": "array",
  "items": { "type": "string" },
  "minItems": 1,
  "maxItems": 10,
  "uniqueItems": true
}
\`\`\`

Tuple 模式：

\`\`\`json
{
  "type": "array",
  "prefixItems": [{ "type": "number" }, { "type": "string" }]
}
\`\`\`
`;

/**
 * Compare two values ignoring `undefined` properties that react-hook-form
 * adds internally for registered-but-empty fields.
 * JSON round-trip strips `undefined`, then deepEqual handles key ordering.
 */
function formEqual(a: unknown, b: unknown): boolean {
  return deepEqual(
    JSON.parse(JSON.stringify(a)),
    JSON.parse(JSON.stringify(b))
  );
}

export function SchemaForm({
  schema,
  onDraftRef,
  onDirtyChange,
  children,
  parametersHidden,
  context,
  templateVariableNames,
}: SchemaFormProps) {
  const form = useForm<SchemaFormValues>({ defaultValues: { ...schema } });
  const originalRef = useRef<SchemaFormValues>({ ...schema });
  const [schemaAssistOpen, setSchemaAssistOpen] = useState(false);

  // Sync form when schema prop changes (after save + SWR refetch, or switching schemas)
  useEffect(() => {
    if (!formEqual(schema, originalRef.current)) {
      originalRef.current = { ...schema };
      form.reset({ ...schema });
      onDirtyChange?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  useEffect(() => {
    onDraftRef({
      getDraft: () => form.getValues(),
      isDirty: () => !formEqual(form.getValues(), originalRef.current),
      reset: () => {
        form.reset({ ...originalRef.current });
      },
      markClean: () => {
        originalRef.current = { ...form.getValues() };
        onDirtyChange?.(false);
      },
    });
  }, [onDraftRef, form, onDirtyChange]);

  useEffect(() => {
    let wasDirty = false;
    const subscription = form.watch(() => {
      const isDirty = !formEqual(form.getValues(), originalRef.current);
      if (isDirty !== wasDirty) {
        wasDirty = isDirty;
        onDirtyChange?.(isDirty);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, onDirtyChange]);

  return (
    <FormProvider {...form}>
      <div className="space-y-3 min-w-0">
        <KeyField value={form.getValues("key")} />
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Name
          </label>
          <Input
            className="mt-1 h-8 text-sm"
            {...form.register("name")}
            placeholder="e.g. Address Fields"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Description
          </label>
          <Textarea
            className="mt-1 min-h-[60px] resize-none text-sm"
            {...form.register("description")}
            placeholder="Describe what this schema represents..."
          />
        </div>

        {/* Parameters header with AI edit + Guide */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            Parameters
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-xs"
            onClick={() => setSchemaAssistOpen(true)}
          >
            <SparklesIcon className="size-3" />
            AI 编辑
          </Button>
          <GuideDialog title="Schema 编辑指南" content={SCHEMA_GUIDE_CONTENT} />
        </div>
        <SchemaCodeAssistDialog
          open={schemaAssistOpen}
          onOpenChange={setSchemaAssistOpen}
          schema={JSON.stringify(form.getValues("parameters") ?? EMPTY_OBJECT_SCHEMA, null, 2)}
          context={context}
          onApply={(newSchemaText) => {
            try {
              form.setValue("parameters", JSON.parse(newSchemaText), { shouldDirty: true });
            } catch {
              // Invalid JSON — ignore
            }
          }}
        />

        {children}

        <div className={parametersHidden ? "hidden" : undefined}>
          <Controller
            name="parameters"
            control={form.control}
            render={({ field }) => (
              <JsonEditor
                value={JSON.stringify(field.value ?? EMPTY_OBJECT_SCHEMA, null, 2)}
                onChange={(text) => {
                  try {
                    field.onChange(JSON.parse(text));
                  } catch {
                    // JSON not valid yet — user is still typing
                  }
                }}
                height="400px"
                templateVariables={templateVariableNames}
              />
            )}
          />
        </div>
      </div>
    </FormProvider>
  );
}
