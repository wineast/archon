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
      {entries.map(([key, propSchema]) => {
        const displayType = getDisplayType(propSchema);
        const isRequired = schema.required?.includes(key) ?? false;

        return (
          <div
            key={key}
            className="flex items-center gap-2 rounded-md border bg-muted/50 px-2.5 py-1.5 text-sm"
          >
            <span className="font-mono text-xs">{key}</span>
            <Badge variant="outline" className="text-[10px]">
              {displayType === "array" && propSchema.items && !Array.isArray(propSchema.items)
                ? `${getDisplayType(propSchema.items)}[]`
                : displayType}
            </Badge>
            {isRequired && (
              <Badge variant="secondary" className="text-[10px]">
                required
              </Badge>
            )}
            {propSchema.description && (
              <span className="text-xs text-muted-foreground truncate">
                {propSchema.description}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
