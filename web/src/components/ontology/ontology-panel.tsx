"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
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
import type { ObjectTypeFormValues } from "./object-type-form";
import { ObjectTypesSidebar } from "./object-types-sidebar";
import { ObjectTypeDetail } from "./object-type-detail";
import { OntologyEmptyState } from "./ontology-empty-state";
import { ObjectTypeCreateDialog } from "./object-type-create-dialog";

export function OntologyPanel({ agentId }: { agentId: string }) {
  const { objectTypes, mutate: mutateTypes } = useObjectTypes(agentId);
  const { objectRelations, mutate: mutateRelations } =
    useObjectRelations(agentId);
  const [activeTypeId, setActiveTypeId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "detail">("sidebar");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

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

  return (
    <div className="flex h-full flex-col">
      <ObjectTypeCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
      />

      {/* Desktop layout */}
      <div className="hidden h-full sm:flex">
        <ObjectTypesSidebar
          objectTypes={objectTypes}
          relations={objectRelations}
          activeTypeId={activeTypeId}
          onSelect={setActiveTypeId}
          onCreate={handleOpenCreateDialog}
        />
        <div className="flex-1 min-w-0 overflow-hidden">
          {activeType ? (
            <ObjectTypeDetail
              key={activeType.id}
              agentId={agentId}
              objectType={activeType}
              allObjectTypes={objectTypes}
              relations={objectRelations}
              onSave={handleSave}
              onDelete={handleDelete}
              onCreateRelation={handleCreateRelation}
              onDeleteRelation={handleDeleteRelation}
              onGenerateTools={handleGenerateTools}
            />
          ) : (
            <OntologyEmptyState onCreate={handleOpenCreateDialog} />
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
                onSave={handleSave}
                onDelete={handleDelete}
                onCreateRelation={handleCreateRelation}
                onDeleteRelation={handleDeleteRelation}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
