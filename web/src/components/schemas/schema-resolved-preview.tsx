"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDownIcon } from "lucide-react";
import type { SchemaWithIncludes } from "@/db/schema";
import { resolveParameters, type ResolvedParameter } from "@/lib/schemas/resolve";

interface SchemaResolvedPreviewProps {
  schema: Pick<SchemaWithIncludes, "id" | "name" | "parameters" | "includeSchemaIds">;
  allSchemas: SchemaWithIncludes[];
}

export function SchemaResolvedPreview({
  schema,
  allSchemas,
}: SchemaResolvedPreviewProps) {
  const allSchemasMap = useMemo(
    () => new Map(allSchemas.map((s) => [s.id, s])),
    [allSchemas]
  );

  const resolved = useMemo(
    () => resolveParameters(schema, allSchemasMap),
    [schema, allSchemasMap]
  );

  if (schema.includeSchemaIds.length === 0) return null;

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group">
        <ChevronDownIcon className="size-3 transition-transform group-data-[state=open]:rotate-180" />
        合并预览 ({resolved.length} 个字段)
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-1">
          {resolved.map((param) => (
            <ResolvedParameterRow key={param.name} param={param} />
          ))}
          {resolved.length === 0 && (
            <p className="text-xs text-muted-foreground">无字段</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ResolvedParameterRow({ param }: { param: ResolvedParameter }) {
  return (
    <div className="flex items-center gap-2 text-xs rounded border px-2 py-1.5">
      <span className="font-mono font-medium">{param.name}</span>
      <span className="text-muted-foreground">{param.type}</span>
      {param.required && (
        <span className="text-[10px] text-orange-500">req</span>
      )}
      <div className="flex-1" />
      {param._source && param._source !== "own" && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {param._source}
        </Badge>
      )}
      {param._source === "own" && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          own
        </Badge>
      )}
    </div>
  );
}
