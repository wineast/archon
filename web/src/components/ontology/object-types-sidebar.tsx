"use client";

import { useTranslations } from "next-intl";
import { ImportIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideDialog } from "@/components/ui/guide-dialog";
import ontologyGuide from "../../../guide/ontology.md";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ObjectTypeRow, ObjectRelationRow } from "@/db/schema";
import { ObjectTypeListItem } from "./object-type-list-item";

interface ObjectTypesSidebarProps {
  objectTypes: ObjectTypeRow[];
  relations: ObjectRelationRow[];
  activeTypeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onImport?: () => void;
}

export function ObjectTypesSidebar({
  objectTypes,
  relations,
  activeTypeId,
  onSelect,
  onCreate,
  onImport,
}: ObjectTypesSidebarProps) {
  const t = useTranslations("build");
  // Count relations per type (as source or target)
  const relationCounts = new Map<string, number>();
  for (const rel of relations) {
    relationCounts.set(rel.sourceTypeId, (relationCounts.get(rel.sourceTypeId) ?? 0) + 1);
    if (rel.targetTypeId !== rel.sourceTypeId) {
      relationCounts.set(rel.targetTypeId, (relationCounts.get(rel.targetTypeId) ?? 0) + 1);
    }
  }

  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">{t("ontology")}</span>
          <GuideDialog title="本体模块" content={ontologyGuide} />
        </div>
        <div className="flex items-center gap-0.5">
          {onImport && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onImport}
              title={t("importFromFile")}
            >
              <ImportIcon className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onCreate}
            title={t("newObjectType")}
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {objectTypes.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("noObjectTypes")}
            </p>
          ) : (
            objectTypes.map((ot) => (
              <ObjectTypeListItem
                key={ot.id}
                objectType={ot}
                isActive={activeTypeId === ot.id}
                onSelect={onSelect}
                relationCount={relationCounts.get(ot.id) ?? 0}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
