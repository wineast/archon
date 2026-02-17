"use client";

import { useCallback, useRef, useState } from "react";
import {
  FileTextIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  ArrowUpIcon,
  ArrowDownIcon,
  PencilIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { WikiDocument } from "@/lib/wiki/types";

interface WikiListItemProps {
  doc: WikiDocument;
  isActive: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<{ title: string; content: string }>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onReorder: (id: string, direction: "up" | "down") => Promise<void>;
}

export function WikiListItem({
  doc,
  isActive,
  onSelect,
  onUpdate,
  onDelete,
  onReorder,
}: WikiListItemProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(doc.title);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback(() => {
    onSelect(doc.id);
  }, [doc.id, onSelect]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    await onDelete(doc.id);
    setDeleting(false);
    setDeleteDialogOpen(false);
  }, [doc.id, onDelete]);

  const pendingRenameRef = useRef(false);

  const handleStartRename = useCallback(() => {
    setRenameValue(doc.title);
    pendingRenameRef.current = true;
    setRenaming(true);
  }, [doc.title]);

  const handleDropdownCloseAutoFocus = useCallback(
    (e: Event) => {
      if (pendingRenameRef.current) {
        e.preventDefault();
        pendingRenameRef.current = false;
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }
    },
    []
  );

  const handleFinishRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== doc.title) {
      onUpdate(doc.id, { title: trimmed });
    }
    setRenaming(false);
  }, [renameValue, doc.id, doc.title, onUpdate]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleFinishRename();
      if (e.key === "Escape") setRenaming(false);
    },
    [handleFinishRename]
  );

  const handleDoubleClick = useCallback(() => {
    handleStartRename();
  }, [handleStartRename]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "group flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent",
          isActive && "bg-muted font-medium"
        )}
        onClick={renaming ? undefined : handleSelect}
        onDoubleClick={renaming ? undefined : handleDoubleClick}
        onKeyDown={(e) => {
          if (!renaming && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleSelect();
          }
        }}
      >
        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />

        {renaming ? (
          <Input
            ref={renameInputRef}
            className="h-6 flex-1 px-1 py-0 text-sm"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleFinishRename}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-left">
            {doc.title || "Untitled"}
          </span>
        )}

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
          <DropdownMenuContent align="start" side="right" onCloseAutoFocus={handleDropdownCloseAutoFocus}>
            <DropdownMenuItem onClick={handleStartRename}>
              <PencilIcon className="mr-2 size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{doc.title || "Untitled"}&rdquo;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this document.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Spinner className="mr-2 size-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
