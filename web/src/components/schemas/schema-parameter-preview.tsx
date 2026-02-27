"use client";

import { Badge } from "@/components/ui/badge";
import type { JsonSchema7 } from "@/lib/schemas/types";
import { getDisplayType } from "@/lib/schemas/json-schema-utils";

interface SchemaParameterPreviewProps {
  schema: JsonSchema7;
}

export function SchemaParameterPreview({ schema }: SchemaParameterPreviewProps) {
  const properties = schema.properties ?? {};
  const entries = Object.entries(properties);

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        No parameters defined in this schema.
      </p>
    );
  }

  return (
    <div className="space-y-1.5 mt-1">
      <ParameterRows entries={entries} parentSchema={schema} depth={0} />
      {schema.additionalProperties === true && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground italic">
          <span>+ accepts additional properties</span>
        </div>
      )}
    </div>
  );
}

// ─── Internal ───

const MAX_DEPTH = 4;

function ParameterRows({
  entries,
  parentSchema,
  depth,
}: {
  entries: [string, JsonSchema7][];
  parentSchema: JsonSchema7;
  depth: number;
}) {
  return entries.map(([key, propSchema]) => (
    <ParameterRow
      key={key}
      name={key}
      schema={propSchema}
      required={parentSchema.required?.includes(key) ?? false}
      depth={depth}
    />
  ));
}

function ParameterRow({
  name,
  schema,
  required,
  depth,
}: {
  name: string;
  schema: JsonSchema7;
  required: boolean;
  depth: number;
}) {
  const displayType = getDisplayType(schema);
  const hasEnum = schema.enum && schema.enum.length > 0;
  const hasNestedProps =
    displayType === "object" &&
    schema.properties &&
    Object.keys(schema.properties).length > 0;

  const row = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border bg-muted/50 px-2.5 py-1.5 text-sm">
      <span className="font-mono text-xs shrink-0">{name}</span>
      <Badge variant="outline" className="text-[10px] shrink-0">
        {displayType === "array" &&
        schema.items &&
        !Array.isArray(schema.items)
          ? `${getDisplayType(schema.items)}[]`
          : displayType}
      </Badge>
      {required && (
        <Badge variant="secondary" className="text-[10px] shrink-0">
          required
        </Badge>
      )}
      {hasEnum && (
        <span className="text-[10px] text-muted-foreground">
          {schema.enum!.map(String).join(" | ")}
        </span>
      )}
      {schema.description && (
        <span className="text-xs text-muted-foreground">
          {schema.description}
        </span>
      )}
    </div>
  );

  if (!hasNestedProps || depth >= MAX_DEPTH) return row;

  return (
    <>
      {row}
      <div className="ml-3 border-l-2 border-muted-foreground/20 pl-3 space-y-1.5">
        <ParameterRows
          entries={Object.entries(schema.properties!)}
          parentSchema={schema}
          depth={depth + 1}
        />
      </div>
    </>
  );
}
