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
  useDataObjects,
  useDataObject,
  createDataObject,
  updateDataObject,
  deleteDataObject,
} from "@/lib/data-objects/hooks";
import { DataObjectsSidebar } from "./data-objects-sidebar";
import { DataObjectDetail } from "./data-object-detail";
import { DataObjectsEmptyState } from "./data-objects-empty-state";
import { DataObjectCreateDialog } from "./data-object-create-dialog";

export function DataObjectsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { objects, mutate: mutateList } = useDataObjects();
  const [activeObjectId, setActiveObjectId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { object: activeObject, mutate: mutateDetail } =
    useDataObject(open ? activeObjectId : null);

  useEffect(() => {
    if (activeObjectId) {
      setMobileView("detail");
    }
  }, [activeObjectId]);

  const openCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleCreateWithKey = useCallback(
    async (key: string, name: string) => {
      const result = await createDataObject(
        { key, name, description: "", data: {} },
        mutateList
      );
      if (result?.id) {
        setActiveObjectId(result.id);
        setCreateDialogOpen(false);
      }
    },
    [mutateList]
  );

  const handleSave = useCallback(
    async (
      id: string,
      data: { name: string; description: string; data: Record<string, unknown> }
    ) => {
      await updateDataObject(id, data, () => {
        mutateList();
        mutateDetail();
      });
    },
    [mutateList, mutateDetail]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteDataObject(id, mutateList);
      if (activeObjectId === id) setActiveObjectId(null);
    },
    [mutateList, activeObjectId]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex h-full w-[95vw] flex-col gap-0 p-0 sm:max-w-[70vw]"
      >
        <SheetTitle className="sr-only">Data Objects</SheetTitle>
        <SheetDescription className="sr-only">
          Manage data object definitions
        </SheetDescription>

        {/* Desktop layout */}
        <div className="hidden h-full sm:flex">
          <DataObjectsSidebar
            objects={objects}
            activeObjectId={activeObjectId}
            onSelect={setActiveObjectId}
            onCreate={openCreateDialog}
          />
          <div className="flex-1 overflow-hidden">
            {activeObject ? (
              <DataObjectDetail
                key={activeObject.id}
                object={activeObject}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ) : (
              <DataObjectsEmptyState onCreate={openCreateDialog} />
            )}
          </div>
        </div>

        {/* Mobile layout */}
        <div className="flex h-full flex-col sm:hidden">
          {mobileView === "sidebar" || !activeObject ? (
            <DataObjectsSidebar
              objects={objects}
              activeObjectId={activeObjectId}
              onSelect={setActiveObjectId}
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
                <DataObjectDetail
                  key={activeObject.id}
                  object={activeObject}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              </div>
            </>
          )}
        </div>
      </SheetContent>

      <DataObjectCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreateWithKey}
      />
    </Sheet>
  );
}
