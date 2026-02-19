"use client";

import { useMemo } from "react";
import { CopyIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { buildJsonSchema } from "@/lib/tools/schema-builder";
import type { SchemaWithIncludes } from "@/db/schema";
import type { SchemaProperty } from "@/lib/schemas/types";

interface SchemaJsonPreviewProps {
  schema: SchemaWithIncludes;
  allSchemas: SchemaWithIncludes[];
}

export function SchemaJsonPreview({ schema, allSchemas }: SchemaJsonPreviewProps) {
  const schemaMap = useMemo(() => {
    const map: Record<string, SchemaProperty[]> = {};
    for (const s of allSchemas) {
      map[s.id] = s.parameters;
    }
    return map;
  }, [allSchemas]);

  const jsonSchema = useMemo(
    () => buildJsonSchema(schema.parameters, { schemaMap }),
    [schema.parameters, schemaMap]
  );

  const jsonText = useMemo(
    () => JSON.stringify(jsonSchema, null, 2),
    [jsonSchema]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleExport = () => {
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schema.key}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <pre className="p-4 font-mono text-xs whitespace-pre-wrap break-all">
          {jsonText}
        </pre>
      </ScrollArea>
      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button size="sm" variant="outline" onClick={handleCopy}>
          <CopyIcon className="mr-1 size-3" />
          Copy
        </Button>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <DownloadIcon className="mr-1 size-3" />
          Export
        </Button>
      </div>
    </div>
  );
}
