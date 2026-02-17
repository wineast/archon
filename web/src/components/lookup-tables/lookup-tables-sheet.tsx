"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useLookupTables,
  useLookupTable,
  createLookupTable,
  updateLookupTable,
  deleteLookupTable,
  saveEntries,
} from "@/lib/lookup-tables/hooks";
import { LookupTablesSidebar } from "./lookup-tables-sidebar";
import { LookupTableDetail } from "./lookup-table-detail";
import { LookupTablesEmptyState } from "./lookup-tables-empty-state";
import { LookupTableCreateDialog } from "./lookup-table-create-dialog";

export function LookupTablesSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { tables, mutate: mutateList } = useLookupTables();
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { table: activeTable, mutate: mutateDetail } =
    useLookupTable(open ? activeTableId : null);

  useEffect(() => {
    if (activeTableId) {
      setMobileView("detail");
    }
  }, [activeTableId]);

  const openCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleCreateWithKey = useCallback(
    async (key: string, name: string) => {
      const result = await createLookupTable(
        { key, name, description: "" },
        mutateList
      );
      if (result?.id) {
        setActiveTableId(result.id);
        setCreateDialogOpen(false);
      }
    },
    [mutateList]
  );

  const handleSave = useCallback(
    async (
      id: string,
      data: { name: string; description: string },
      entries: Array<{
        value: string;
        label?: string;
        metadata?: Record<string, unknown> | null;
      }>
    ) => {
      await updateLookupTable(id, data, mutateList);
      await saveEntries(id, entries, mutateDetail);
    },
    [mutateList, mutateDetail]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteLookupTable(id, mutateList);
      if (activeTableId === id) setActiveTableId(null);
    },
    [mutateList, activeTableId]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex h-full w-[95vw] flex-col gap-0 p-0 sm:max-w-[70vw]"
      >
        <SheetTitle className="sr-only">Lookup Tables</SheetTitle>
        <SheetDescription className="sr-only">
          Manage lookup table definitions
        </SheetDescription>

        {/* Desktop layout */}
        <div className="hidden h-full sm:flex">
          <LookupTablesSidebar
            tables={tables}
            activeTableId={activeTableId}
            onSelect={setActiveTableId}
            onCreate={openCreateDialog}
          />
          <div className="flex-1 overflow-hidden">
            {activeTable ? (
              <LookupTableDetail
                key={activeTable.id}
                table={activeTable}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ) : (
              <LookupTablesEmptyState onCreate={openCreateDialog} />
            )}
          </div>
        </div>

        {/* Mobile layout */}
        <div className="flex h-full flex-col sm:hidden">
          {mobileView === "sidebar" || !activeTable ? (
            <LookupTablesSidebar
              tables={tables}
              activeTableId={activeTableId}
              onSelect={setActiveTableId}
              onCreate={openCreateDialog}
            />
          ) : (
            <>
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setMobileView("sidebar")}
                >
                  <ArrowLeftIcon className="size-4" />
                </Button>
                <span className="text-sm font-medium">Back</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <LookupTableDetail
                  key={activeTable.id}
                  table={activeTable}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              </div>
            </>
          )}
        </div>
      </SheetContent>

      <LookupTableCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreateWithKey}
      />
    </Sheet>
  );
}
