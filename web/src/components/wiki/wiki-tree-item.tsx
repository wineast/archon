"use client";

import { useCallback, useState } from "react";
import {
  FileTextIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { WikiDocument } from "@/lib/wiki/types";

interface WikiListItemProps {
  doc: WikiDocument;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<boolean>;
  onReorder: (id: string, direction: "up" | "down") => Promise<void>;
}

export function WikiListItem({
  doc,
  isActive,
  onSelect,
  onDelete,
  onReorder,
}: WikiListItemProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleSelect = useCallback(() => {
    onSelect(doc.id);
  }, [doc.id, onSelect]);

  const handleDelete = useCallback(async () => {
    await onDelete(doc.id);
  }, [doc.id, onDelete]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "group flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent",
          isActive && "bg-muted font-medium"
        )}
        onClick={handleSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleSelect();
          }
        }}
      >
        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />

        <span className="min-w-0 flex-1 truncate text-left">
          {doc.name || "Untitled"}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontalIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right">
            <DropdownMenuItem onClick={() => onReorder(doc.id, "up")}>
              <ArrowUpIcon className="mr-2 size-4" />
              Move Up
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReorder(doc.id, "down")}>
              <ArrowDownIcon className="mr-2 size-4" />
              Move Down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2Icon className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete "${doc.name || "Untitled"}"?`}
        description="This will permanently delete this document."
        onConfirm={handleDelete}
      />
    </>
  );
}
