"use client";

import { useCallback, useState } from "react";
import { ArrowRightIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ObjectTypeRow, ObjectRelationRow } from "@/db/schema";

interface RelationListProps {
  relations: ObjectRelationRow[];
  objectTypes: ObjectTypeRow[];
  currentTypeId: string;
  onAdd: () => void;
  onDelete: (id: string) => Promise<void>;
}

export function RelationList({
  relations,
  objectTypes,
  currentTypeId,
  onAdd,
  onDelete,
}: RelationListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const typeMap = new Map(objectTypes.map((t) => [t.id, t]));

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        await onDelete(id);
      } finally {
        setDeletingId(null);
      }
    },
    [onDelete]
  );

  // Show relations where current type is source or target
  const relevantRelations = relations.filter(
    (r) => r.sourceTypeId === currentTypeId || r.targetTypeId === currentTypeId
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          Relations
        </label>
        <Button variant="ghost" size="icon-xs" onClick={onAdd} title="Add Relation">
          <PlusIcon className="size-3.5" />
        </Button>
      </div>

      {relevantRelations.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No relations defined</p>
      ) : (
        <div className="space-y-1">
          {relevantRelations.map((rel) => {
            const isSource = rel.sourceTypeId === currentTypeId;
            const otherType = typeMap.get(
              isSource ? rel.targetTypeId : rel.sourceTypeId
            );
            const label = isSource ? rel.name : rel.inverseName || rel.name;

            return (
              <div
                key={rel.id}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
              >
                <span className="font-medium truncate">{label}</span>
                <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">
                  {otherType?.name ?? "Unknown"}
                </span>
                <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                  {rel.relationType.replace("_", " ")}
                </span>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleDelete(rel.id)}
                  disabled={deletingId === rel.id}
                >
                  {deletingId === rel.id ? (
                    <Spinner className="size-3" />
                  ) : (
                    <Trash2Icon className="size-3" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
