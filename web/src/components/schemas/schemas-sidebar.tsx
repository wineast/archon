"use client";

import { useTranslations } from "next-intl";
import { PlusIcon, GlobeIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideDialog } from "@/components/ui/guide-dialog";
import schemasGuide from "../../../guide/schemas.md";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SchemaRow } from "@/db/schema";
import type { WithPoolMeta } from "@/lib/pool/queries";
import { SchemaListItem } from "./schema-list-item";

interface SchemasSidebarProps {
  schemas: WithPoolMeta<SchemaRow>[];
  activeSchemaId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onAddFromPool?: () => void;
  onRemoveRef?: (refId: string) => void;
}

export function SchemasSidebar({
  schemas,
  activeSchemaId,
  onSelect,
  onCreate,
  onAddFromPool,
  onRemoveRef,
}: SchemasSidebarProps) {
  const t = useTranslations("build");
  const ta = useTranslations("admin");

  const privateSchemas = schemas.filter((s) => s._source === "private");
  const poolSchemas = schemas.filter((s) => s._source === "pool");

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
          {privateSchemas.length === 0 && poolSchemas.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("noSchemas")}
            </p>
          ) : (
            <>
              {privateSchemas.map((schema) => (
                <SchemaListItem
                  key={schema.id}
                  schema={schema}
                  isActive={activeSchemaId === schema.id}
                  onSelect={onSelect}
                />
              ))}

              {poolSchemas.length > 0 && (
                <>
                  <div className="mt-2 mb-1 px-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {ta("poolRefs")}
                    </span>
                  </div>
                  {poolSchemas.map((schema) => (
                    <div key={schema.id} className="group flex items-center">
                      <button
                        type="button"
                        className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted ${
                          activeSchemaId === schema.id ? "bg-muted font-medium" : ""
                        }`}
                        onClick={() => onSelect(schema.id)}
                      >
                        <GlobeIcon className="size-3 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-left">{schema.name}</span>
                      </button>
                      {schema._refId && onRemoveRef && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="mr-1 opacity-0 group-hover:opacity-100"
                          onClick={() => onRemoveRef(schema._refId!)}
                          title={ta("removeRef")}
                        >
                          <XIcon className="size-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
      {onAddFromPool && (
        <div className="border-t px-3 py-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onAddFromPool}
          >
            <GlobeIcon className="mr-1 size-3" />
            {ta("addFromPool")}
          </Button>
        </div>
      )}
    </div>
  );
}
