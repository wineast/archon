"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, ListIcon, NetworkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useObjectTypes,
  createObjectType,
  updateObjectType,
  deleteObjectType,
  useObjectRelations,
  createObjectRelation,
  deleteObjectRelation,
  generateCrudTools,
} from "@/lib/ontology/hooks";
import { useSchemas } from "@/lib/schemas/hooks";
import type { ObjectTypeFormValues } from "./object-type-form";
import { ObjectTypesSidebar } from "./object-types-sidebar";
import { ObjectTypeDetail } from "./object-type-detail";
import { OntologyEmptyState } from "./ontology-empty-state";
import { ObjectTypeCreateDialog } from "./object-type-create-dialog";
import { OntologyGraph } from "./ontology-graph";
import { ImportTypeDialog } from "./import-type-dialog";

type DesktopViewMode = "list" | "graph";

export function OntologyPanel({ agentId }: { agentId: string }) {
  const { objectTypes, mutate: mutateTypes } = useObjectTypes(agentId);
  const { objectRelations, mutate: mutateRelations } =
    useObjectRelations(agentId);
  const { schemas, mutate: mutateSchemas } = useSchemas(agentId);
  const [activeTypeId, setActiveTypeId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importTypeDialogOpen, setImportTypeDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<DesktopViewMode>("list");

  const activeType = useMemo(
    () => objectTypes.find((t) => t.id === activeTypeId) ?? null,
    [objectTypes, activeTypeId]
  );

  useEffect(() => {
    if (activeTypeId) {
      setMobileView("detail");
    }
  }, [activeTypeId]);

  const handleOpenCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleCreate = useCallback(
    async (key: string, name: string) => {
      const result = await createObjectType(
        { agentId, key, name, description: "" },
        mutateTypes
      );
      if (result?.id) {
        setActiveTypeId(result.id);
        setCreateDialogOpen(false);
      }
    },
    [agentId, mutateTypes]
  );

  const handleSave = useCallback(
    async (id: string, data: Omit<ObjectTypeFormValues, "key">) => {
      await updateObjectType(id, data, mutateTypes);
    },
    [mutateTypes]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = await deleteObjectType(id, mutateTypes);
      if (ok && activeTypeId === id) setActiveTypeId(null);
    },
    [mutateTypes, activeTypeId]
  );

  const handleCreateRelation = useCallback(
    async (data: {
      key: string;
      name: string;
      sourceTypeId: string;
      targetTypeId: string;
      relationType: string;
      inverseName: string;
    }) => {
      await createObjectRelation(
        { agentId, ...data },
        mutateRelations
      );
    },
    [agentId, mutateRelations]
  );

  const handleDeleteRelation = useCallback(
    async (id: string) => {
      await deleteObjectRelation(id, mutateRelations);
    },
    [mutateRelations]
  );

  const handleGenerateTools = useCallback(
    async (id: string) => {
      await generateCrudTools(id, mutateTypes);
    },
    [mutateTypes]
  );

  const detailPanel = activeType ? (
    <ObjectTypeDetail
      key={activeType.id}
      agentId={agentId}
      objectType={activeType}
      allObjectTypes={objectTypes}
      relations={objectRelations}
      schemas={schemas}
      onSave={handleSave}
      onDelete={handleDelete}
      onCreateRelation={handleCreateRelation}
      onDeleteRelation={handleDeleteRelation}
      onGenerateTools={handleGenerateTools}
    />
  ) : null;

  return (
    <div className="flex h-full flex-col">
      <ObjectTypeCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
      />
      <ImportTypeDialog
        open={importTypeDialogOpen}
        onOpenChange={setImportTypeDialogOpen}
        agentId={agentId}
        onCreated={mutateTypes}
        mutateSchemas={mutateSchemas}
      />

      {/* Desktop layout */}
      <div className="hidden h-full flex-col sm:flex">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b px-3 py-1.5">
          <span className="text-sm font-semibold">Ontology</span>
          <div className="flex-1" />
          <div className="flex items-center rounded-md border p-0.5">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon-xs"
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <ListIcon className="size-3.5" />
            </Button>
            <Button
              variant={viewMode === "graph" ? "secondary" : "ghost"}
              size="icon-xs"
              onClick={() => setViewMode("graph")}
              title="Graph view"
            >
              <NetworkIcon className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex flex-1 min-h-0">
          {viewMode === "list" ? (
            <>
              <ObjectTypesSidebar
                objectTypes={objectTypes}
                relations={objectRelations}
                activeTypeId={activeTypeId}
                onSelect={setActiveTypeId}
                onCreate={handleOpenCreateDialog}
                onImport={() => setImportTypeDialogOpen(true)}
              />
              <div className="flex-1 min-w-0 overflow-hidden">
                {detailPanel ?? (
                  <OntologyEmptyState onCreate={handleOpenCreateDialog} />
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <OntologyGraph
                  objectTypes={objectTypes}
                  objectRelations={objectRelations}
                  activeTypeId={activeTypeId}
                  onSelectType={setActiveTypeId}
                />
              </div>
              {activeType && (
                <div className="w-80 shrink-0 overflow-hidden border-l">
                  {detailPanel}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col sm:hidden">
        {mobileView === "sidebar" || !activeType ? (
          <ObjectTypesSidebar
            objectTypes={objectTypes}
            relations={objectRelations}
            activeTypeId={activeTypeId}
            onSelect={setActiveTypeId}
            onCreate={handleOpenCreateDialog}
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
            <div className="flex-1 min-w-0 overflow-hidden">
              <ObjectTypeDetail
                key={activeType.id}
                agentId={agentId}
                objectType={activeType}
                allObjectTypes={objectTypes}
                relations={objectRelations}
                schemas={schemas}
                onSave={handleSave}
                onDelete={handleDelete}
                onCreateRelation={handleCreateRelation}
                onDeleteRelation={handleDeleteRelation}
                onGenerateTools={handleGenerateTools}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
