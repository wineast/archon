"use client";

import { useMemo, useState } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { MemoryRow } from "@/db/schema";
import { MemoryDetail } from "./memory-detail";

interface MemoryListProps {
  memories: MemoryRow[];
  allTypes: string[];
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (memory: MemoryRow) => void;
  onAdd: () => void;
}

export function MemoryList({
  memories,
  allTypes,
  onSave,
  onDelete,
  onAdd,
}: MemoryListProps) {
  const [activeMemoryId, setActiveMemoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return memories;
    const q = search.toLowerCase();
    return memories.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q) ||
        (m.userId && m.userId.toLowerCase().includes(q))
    );
  }, [memories, search]);

  const activeMemory = useMemo(
    () => memories.find((m) => m.id === activeMemoryId) ?? null,
    [memories, activeMemoryId]
  );

  return (
    <div className="flex h-full min-h-0">
      {/* Left: sidebar */}
      <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-7 pl-7 text-xs"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onAdd}
            title="New Memory"
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
          <div className="p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No memories
              </p>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent",
                    activeMemoryId === m.id && "bg-muted font-medium"
                  )}
                  onClick={() => setActiveMemoryId(m.id)}
                >
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-[10px] h-4 px-1.5"
                    >
                      {m.type}
                    </Badge>
                    {m.userId && (
                      <span className="truncate text-[10px] text-muted-foreground">
                        {m.userId}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {m.content}
                  </span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right: detail */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {activeMemory ? (
          <MemoryDetail
            key={activeMemory.id}
            memory={activeMemory}
            allTypes={allTypes}
            onSave={onSave}
            onDelete={onDelete}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Select a memory to view details
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
