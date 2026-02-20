"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { MemoryRow } from "@/db/schema";

interface MemoryListProps {
  memories: MemoryRow[];
  onEdit: (memory: MemoryRow) => void;
  onDelete: (memory: MemoryRow) => void;
  onAdd: () => void;
}

export function MemoryList({
  memories,
  onEdit,
  onDelete,
  onAdd,
}: MemoryListProps) {
  const [selectedUser, setSelectedUser] = useState<string>("all");

  // Build user list with counts from all memories (before filtering)
  const userEntries = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of memories) {
      const key = m.userId || "global";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [memories]);

  const filtered = useMemo(() => {
    if (selectedUser === "all") return memories;
    return memories.filter((m) =>
      selectedUser === "global" ? !m.userId : m.userId === selectedUser
    );
  }, [memories, selectedUser]);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left: user list */}
      <ScrollArea className="w-40 shrink-0 border-r min-h-0">
        <div className="flex flex-col py-1">
          <button
            type="button"
            className={cn(
              "flex items-center justify-between px-3 py-1.5 text-xs hover:bg-accent",
              selectedUser === "all" && "bg-accent font-medium"
            )}
            onClick={() => setSelectedUser("all")}
          >
            <span>All</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {memories.length}
            </Badge>
          </button>
          {userEntries.map(([userId, count]) => (
            <button
              key={userId}
              type="button"
              className={cn(
                "flex items-center justify-between px-3 py-1.5 text-xs hover:bg-accent",
                selectedUser === userId && "bg-accent font-medium"
              )}
              onClick={() => setSelectedUser(userId)}
            >
              <span className="truncate mr-1">{userId}</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {count}
              </Badge>
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Right: toolbar + table */}
      <div className="flex flex-1 flex-col min-h-0 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex-1" />
          <Button size="sm" onClick={onAdd}>
            <PlusIcon className="mr-1 size-3" />
            Add
          </Button>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">No memories yet.</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Importance</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow
                    key={m.id}
                    className="cursor-pointer"
                    onClick={() => onEdit(m)}
                  >
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {m.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {m.content}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 w-20">
                        <Progress
                          value={(m.importance ?? 0.5) * 100}
                          className="h-1.5"
                        />
                        <span className="text-xs text-muted-foreground w-7 text-right">
                          {((m.importance ?? 0.5) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.createdAt
                        ? new Date(m.createdAt).toLocaleDateString()
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
