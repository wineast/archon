"use client";

import { useCallback, useMemo, useState } from "react";
import { UploadIcon, FileSpreadsheetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { parseFile, inferColumnTypes, type ParsedFile } from "@/lib/ontology/import";
import { createSchema } from "@/lib/schemas/hooks";
import { createObjectType, updateObjectType, batchCreateObjectInstances } from "@/lib/ontology/hooks";
import type { SchemaProperty } from "@/lib/schemas/types";

type Step = "upload" | "preview" | "config";

interface ImportTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onCreated: () => void;
  mutateSchemas: () => void;
}

function formatKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function ImportTypeDialog({
  open,
  onOpenChange,
  agentId,
  onCreated,
  mutateSchemas,
}: ImportTypeDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [columnTypes, setColumnTypes] = useState<
    Record<string, "string" | "number" | "boolean">
  >({});
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleClose = useCallback(() => {
    setParsed(null);
    setColumnTypes({});
    setKey("");
    setName("");
    setStep("upload");
    setCreating(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleFile = useCallback(async (file: File) => {
    try {
      const result = await parseFile(file);
      setParsed(result);
      setColumnTypes(inferColumnTypes(result.headers, result.rows));
      // Auto-suggest key/name from file name
      const baseName = file.name.replace(/\.[^.]+$/, "");
      setKey(formatKey(baseName));
      setName(baseName.replace(/[_-]/g, " "));
      setStep("preview");
    } catch {
      // parse error
    }
  }, []);

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

  const inferredSchema = useMemo<SchemaProperty[]>(() => {
    if (!parsed) return [];
    return parsed.headers.map((h, i) => ({
      id: `prop-${i}`,
      name: h,
      type: columnTypes[h] ?? "string",
      description: "",
      required: false,
    }));
  }, [parsed, columnTypes]);

  const handleCreate = useCallback(async () => {
    if (!parsed || !key.trim()) return;
    setCreating(true);
    try {
      // 1. Create schema
      const schemaResult = await createSchema(
        {
          agentId,
          key: `${key.trim()}_schema`,
          name: `${name.trim() || key.trim()} Schema`,
          parameters: inferredSchema,
        },
        mutateSchemas
      );
      if (!schemaResult?.id) return;

      // 2. Create object type
      const typeResult = await createObjectType(
        {
          agentId,
          key: key.trim(),
          name: name.trim() || key.trim(),
          schemaId: schemaResult.id,
        },
        onCreated
      );
      if (!typeResult?.id) return;

      // Set titleProperty to the first column
      if (parsed.headers[0]) {
        await updateObjectType(
          typeResult.id,
          { titleProperty: parsed.headers[0] },
          onCreated
        );
      }

      // 3. Batch import instances
      const items = parsed.rows.map((row) => {
        const data: Record<string, unknown> = {};
        for (const prop of inferredSchema) {
          const val = row[prop.name];
          if (val != null && val !== "") {
            switch (prop.type) {
              case "number":
                data[prop.name] = Number(val);
                break;
              case "boolean": {
                const s = String(val).toLowerCase();
                data[prop.name] = s === "true" || s === "1";
                break;
              }
              default:
                data[prop.name] = String(val);
            }
          }
        }
        return { data };
      });

      await batchCreateObjectInstances(
        { agentId, objectTypeId: typeResult.id, items },
        () => {} // Instances are per-type; the main mutate handles objectTypes
      );

      handleClose();
    } finally {
      setCreating(false);
    }
  }, [
    parsed,
    key,
    name,
    agentId,
    inferredSchema,
    onCreated,
    mutateSchemas,
    handleClose,
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !creating && (v ? onOpenChange(v) : handleClose())}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from File</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV or Excel file to create a new Object Type."}
            {step === "preview" && "Review inferred schema from your data."}
            {step === "config" && "Configure the Object Type name and key."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div
            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25"
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

        {step === "preview" && parsed && (
          <div className="space-y-4">
            <div className="text-xs font-medium text-muted-foreground">
              Inferred schema ({inferredSchema.length} columns,{" "}
              {parsed.rows.length} rows)
            </div>
            <ScrollArea className="max-h-[300px] [&_[data-slot=scroll-area-viewport]>div]:!block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Column</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Sample</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inferredSchema.map((prop) => (
                    <TableRow key={prop.id}>
                      <TableCell className="font-medium">{prop.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {prop.type}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {String(parsed.rows[0]?.[prop.name] ?? "")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === "config" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Key
              </label>
              <Input
                className="mt-1 h-8 text-sm font-mono"
                value={key}
                onChange={(e) => setKey(formatKey(e.target.value))}
                placeholder="e.g. customer"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                className="mt-1 h-8 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Customer"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This will create a Schema, Object Type, and{" "}
              {parsed?.rows.length ?? 0} instances.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={() => setStep("config")}>Next</Button>
            </>
          )}
          {step === "config" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("preview")}
                disabled={creating}
              >
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !key.trim()}
              >
                {creating && <Spinner className="mr-1.5 size-3" />}
                Create
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
