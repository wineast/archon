"use client";

import { useMemo } from "react";
import { CopyIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { buildJsonSchema } from "@/lib/tools/schema-builder";
import type { SchemaWithIncludes } from "@/db/schema";
import type { SchemaProperty } from "@/lib/schemas/types";

interface SchemaJsonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schemaKey: string;
  /** Called on open to snapshot the current form parameters. */
  getParameters: () => SchemaProperty[];
  allSchemas: SchemaWithIncludes[];
}

export function SchemaJsonDialog({
  open,
  onOpenChange,
  schemaKey,
  getParameters,
  allSchemas,
}: SchemaJsonDialogProps) {
  const schemaMap = useMemo(() => {
    const map: Record<string, SchemaProperty[]> = {};
    for (const s of allSchemas) {
      map[s.id] = s.parameters;
    }
    return map;
  }, [allSchemas]);

  // Snapshot parameters when dialog opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const parameters = useMemo(() => getParameters(), [open, getParameters]);

  const jsonSchema = useMemo(
    () => buildJsonSchema(parameters, { schemaMap }),
    [parameters, schemaMap]
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
    a.download = `${schemaKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>JSON Schema</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0">
          <pre className="px-4 pb-4 font-mono text-xs whitespace-pre-wrap break-all">
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
      </DialogContent>
    </Dialog>
  );
}
