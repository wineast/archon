"use client";

import { useMemo } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WikiDocument } from "@/lib/wiki/types";
import { WikiListItem } from "./wiki-tree-item";

interface WikiSidebarProps {
  documents: WikiDocument[];
  activeDocId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => Promise<void>;
  onUpdate: (id: string, updates: Partial<{ title: string; content: string }>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onReorder: (id: string, direction: "up" | "down") => Promise<void>;
}

export function WikiSidebar({
  documents,
  activeDocId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
}: WikiSidebarProps) {
  const sorted = useMemo(
    () => [...documents].sort((a, b) => a.order - b.order),
    [documents]
  );

  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Documents</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          title="New Document"
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="px-0.5 py-0.5">
          {sorted.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No documents yet
            </p>
          ) : (
            sorted.map((doc) => (
              <WikiListItem
                key={doc.id}
                doc={doc}
                isActive={activeDocId === doc.id}
                onSelect={onSelect}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onReorder={onReorder}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
