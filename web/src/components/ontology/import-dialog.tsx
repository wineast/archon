"use client";

import { useCallback, useMemo, useState } from "react";
import { UploadIcon, FileSpreadsheetIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseFile, type ParsedFile } from "@/lib/ontology/import";
import { batchCreateObjectInstances } from "@/lib/ontology/hooks";
import type { ObjectTypeRow, SchemaWithIncludes } from "@/db/schema";
import type { SchemaProperty } from "@/lib/schemas/types";

type Step = "upload" | "mapping" | "confirm";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  objectType: ObjectTypeRow;
  schema: SchemaWithIncludes;
  onImported: () => void;
}

export function ImportDialog({
  open,
  onOpenChange,
  agentId,
  objectType,
  schema,
  onImported,
}: ImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const schemaProps = schema.parameters;

  const handleClose = useCallback(() => {
    setParsed(null);
    setMapping({});
    setStep("upload");
    setImporting(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const result = await parseFile(file);
        setParsed(result);
        // Auto-match: file header → schema prop name
        const autoMap: Record<string, string> = {};
        for (const prop of schemaProps) {
          const match = result.headers.find(
            (h) => h.toLowerCase() === prop.name.toLowerCase()
          );
          if (match) autoMap[prop.name] = match;
        }
        setMapping(autoMap);
        setStep("mapping");
      } catch {
        // parseFile already shows error context
      }
    },
    [schemaProps]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleMappingChange = useCallback(
    (propName: string, header: string) => {
      setMapping((prev) => {
        const next = { ...prev };
        if (header === "__none__") {
          delete next[propName];
        } else {
          next[propName] = header;
        }
        return next;
      });
    },
    []
  );

  const mappedItems = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((row) => {
      const data: Record<string, unknown> = {};
      for (const prop of schemaProps) {
        const header = mapping[prop.name];
        if (header) {
          data[prop.name] = coerceValue(row[header], prop);
        }
      }
      return { data };
    });
  }, [parsed, mapping, schemaProps]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      await batchCreateObjectInstances(
        { agentId, objectTypeId: objectType.id, items: mappedItems },
        onImported
      );
      handleClose();
    } finally {
      setImporting(false);
    }
  }, [agentId, objectType.id, mappedItems, onImported, handleClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !importing && (v ? onOpenChange(v) : handleClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Instances</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV or Excel file."}
            {step === "mapping" && "Map file columns to schema properties."}
            {step === "confirm" &&
              `Ready to import ${mappedItems.length} instance(s).`}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div
            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <UploadIcon className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag & drop a .csv or .xlsx file here, or
            </p>
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span>
                  <FileSpreadsheetIcon className="mr-1 size-3" />
                  Browse File
                </span>
              </Button>
              <input
                type="file"
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={handleInputChange}
              />
            </label>
          </div>
        )}

        {step === "mapping" && parsed && (
          <div className="space-y-4">
            {/* Column mapping */}
            <div className="space-y-2">
              {schemaProps.map((prop) => (
                <div key={prop.id} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-sm font-medium">
                    {prop.name}
                  </span>
                  <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground" />
                  <Select
                    value={mapping[prop.name] ?? "__none__"}
                    onValueChange={(v) => handleMappingChange(prop.name, v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="(skip)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">(skip)</SelectItem>
                      {parsed.headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="text-xs font-medium text-muted-foreground">
              Preview (first 5 rows)
            </div>
            <ScrollArea className="max-h-[200px] [&_[data-slot=scroll-area-viewport]>div]:!block">
              <Table>
                <TableHeader>
                  <TableRow>
                    {schemaProps
                      .filter((p) => mapping[p.name])
                      .map((p) => (
                        <TableHead key={p.id}>{p.name}</TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedItems.slice(0, 5).map((item, i) => (
                    <TableRow key={i}>
                      {schemaProps
                        .filter((p) => mapping[p.name])
                        .map((p) => (
                          <TableCell key={p.id} className="max-w-[150px] truncate">
                            {String(item.data[p.name] ?? "")}
                          </TableCell>
                        ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === "confirm" && (
          <div className="py-4 text-center">
            <p className="text-lg font-semibold">{mappedItems.length}</p>
            <p className="text-sm text-muted-foreground">
              instance(s) will be imported
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={() => setStep("confirm")}
                disabled={Object.keys(mapping).length === 0}
              >
                Next
              </Button>
            </>
          )}
          {step === "confirm" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("mapping")}
                disabled={importing}
              >
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing && <Spinner className="mr-1.5 size-3" />}
                Import
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function coerceValue(val: unknown, prop: SchemaProperty): unknown {
  if (val == null || val === "") return undefined;
  switch (prop.type) {
    case "number":
      return Number(val);
    case "boolean": {
      const s = String(val).toLowerCase();
      return s === "true" || s === "1";
    }
    default:
      return String(val);
  }
}
