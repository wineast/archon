"use client";

import { useTranslations } from "next-intl";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideDialog } from "@/components/ui/guide-dialog";
import schemasGuide from "../../../guide/schemas.md";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SchemaRow } from "@/db/schema";
import { SchemaListItem } from "./schema-list-item";

interface SchemasSidebarProps {
  schemas: SchemaRow[];
  activeSchemaId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function SchemasSidebar({
  schemas,
  activeSchemaId,
  onSelect,
  onCreate,
}: SchemasSidebarProps) {
  const t = useTranslations("build");
  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">{t("schemas")}</span>
          <GuideDialog title="Schema 模块" content={schemasGuide} />
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          title={t("newSchema")}
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {schemas.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("noSchemas")}
            </p>
          ) : (
            schemas.map((schema) => (
              <SchemaListItem
                key={schema.id}
                schema={schema}
                isActive={activeSchemaId === schema.id}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
