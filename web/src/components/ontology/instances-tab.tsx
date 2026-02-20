"use client";

import { useCallback, useMemo, useState } from "react";
import { PlusIcon, Trash2Icon, PencilIcon, ImportIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import {
  useObjectInstances,
  deleteObjectInstance,
} from "@/lib/ontology/hooks";
import { InstanceCreateDialog } from "./instance-create-dialog";
import { InstanceEditSheet } from "./instance-edit-sheet";
import { ImportDialog } from "./import-dialog";
import type { ObjectTypeRow, ObjectInstanceRow, SchemaWithIncludes } from "@/db/schema";
import type { SchemaProperty } from "@/lib/schemas/types";

const SIMPLE_TYPES = new Set(["string", "number", "boolean", "enum"]);

interface InstancesTabProps {
  agentId: string;
  objectType: ObjectTypeRow;
  schemas: SchemaWithIncludes[];
}

export function InstancesTab({ agentId, objectType, schemas }: InstancesTabProps) {
  const { instances, isLoading, mutate } = useObjectInstances(agentId, objectType.id);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editInstance, setEditInstance] = useState<ObjectInstanceRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ObjectInstanceRow | null>(null);

  const schema = useMemo(
    () => schemas.find((s) => s.id === objectType.schemaId) ?? null,
    [schemas, objectType.schemaId]
  );

  const columns = useMemo<SchemaProperty[]>(() => {
    if (!schema) return [];
    return schema.parameters.filter((p) => SIMPLE_TYPES.has(p.type));
  }, [schema]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteObjectInstance(deleteTarget.id, mutate);
    setDeleteTarget(null);
  }, [deleteTarget, mutate]);

  const handleExport = useCallback(async () => {
    if (!schema || instances.length === 0) return;
    const Papa = await import("papaparse");
    const propNames = schema.parameters.map((p) => p.name);
    const rows = instances.map((inst) => {
      const row: Record<string, unknown> = {};
      for (const name of propNames) {
        row[name] = inst.data[name] ?? "";
      }
      return row;
    });
    const csv = Papa.unparse(rows, { columns: propNames });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${objectType.key}-instances.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [schema, instances, objectType.key]);

  if (!schema) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          Please bind a Schema first to manage instances.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2">
        <Badge variant="secondary" className="text-xs">
          {instances.length} instance{instances.length !== 1 ? "s" : ""}
        </Badge>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={instances.length === 0}
        >
          <DownloadIcon className="mr-1 size-3" />
          Export
        </Button>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <ImportIcon className="mr-1 size-3" />
          Import
        </Button>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="mr-1 size-3" />
          Add
        </Button>
      </div>

      {/* Table */}
      {instances.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">No instance data yet.</p>
        </div>
      ) : (
        <ScrollArea
          className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                {columns.map((col) => (
                  <TableHead key={col.id}>{col.name}</TableHead>
                ))}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((inst) => (
                <TableRow
                  key={inst.id}
                  className="cursor-pointer"
                  onClick={() => setEditInstance(inst)}
                >
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {inst.label || <span className="text-muted-foreground italic">untitled</span>}
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell key={col.id} className="max-w-[200px] truncate">
                      {formatCellValue(inst.data[col.name])}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditInstance(inst);
                        }}
                      >
                        <PencilIcon className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(inst);
                        }}
                      >
                        <Trash2Icon className="size-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}

      {/* Create dialog */}
      <InstanceCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        agentId={agentId}
        objectType={objectType}
        schema={schema}
        onCreated={mutate}
      />

      {/* Import dialog */}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        agentId={agentId}
        objectType={objectType}
        schema={schema}
        onImported={mutate}
      />

      {/* Edit sheet */}
      <InstanceEditSheet
        open={!!editInstance}
        onOpenChange={(open) => {
          if (!open) setEditInstance(null);
        }}
        agentId={agentId}
        instance={editInstance}
        schema={schema}
        mutate={mutate}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Instance"
        description={`Are you sure you want to delete "${deleteTarget?.label || "this instance"}"? This action cannot be undone.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}
