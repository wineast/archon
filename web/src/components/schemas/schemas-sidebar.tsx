"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Schemas</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          title="New Schema"
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {schemas.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No schemas yet
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
