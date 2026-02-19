"use client";

import { Badge } from "@/components/ui/badge";
import type { ToolParameter } from "@/lib/tools/types";

interface SchemaParameterPreviewProps {
  parameters: ToolParameter[];
}

export function SchemaParameterPreview({ parameters }: SchemaParameterPreviewProps) {
  if (parameters.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        No parameters defined in this schema.
      </p>
    );
  }

  return (
    <div className="space-y-1.5 mt-1">
      {parameters.map((param) => (
        <div
          key={param.id}
          className="flex items-center gap-2 rounded-md border bg-muted/50 px-2.5 py-1.5 text-sm"
        >
          <span className="font-mono text-xs">{param.name}</span>
          <Badge variant="outline" className="text-[10px]">
            {param.isArray ? `${param.type}[]` : param.type}
          </Badge>
          {param.required && (
            <Badge variant="secondary" className="text-[10px]">
              required
            </Badge>
          )}
          {param.description && (
            <span className="text-xs text-muted-foreground truncate">
              {param.description}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
