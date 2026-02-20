"use client";

import { useCallback, useMemo, useState } from "react";
import {
  FileTextIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronRightIcon,
  PlusIcon,
  CornerLeftUpIcon,
  MoveIcon,
  ArrowUpToLineIcon,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { WikiDocument } from "@/lib/wiki/types";

export interface WikiTreeNode {
  doc: WikiDocument;
  children: WikiTreeNode[];
}

/** Collect all descendant IDs of a document (to exclude from move targets) */
function getDescendantIds(docId: string, docs: WikiDocument[]): Set<string> {
  const ids = new Set<string>();
  const queue = [docId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const d of docs) {
      if (d.parentId === current && !ids.has(d.id)) {
        ids.add(d.id);
        queue.push(d.id);
      }
    }
  }
  return ids;
}

interface WikiTreeItemProps {
  node: WikiTreeNode;
  activeDocId: string | null;
  expandedIds: Set<string>;
  /** parentId of this node's parent (undefined for root nodes) */
  grandparentId?: string | null;
  documents: WikiDocument[];
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<boolean>;
  onReorder: (id: string, direction: "up" | "down") => Promise<void>;
  onAddChild: (parentId: string) => void;
  onMove: (id: string, targetParentId: string | null) => void;
}

export function WikiTreeItem({
  node,
  activeDocId,
  expandedIds,
  grandparentId,
  documents,
  onToggle,
  onSelect,
  onDelete,
  onReorder,
  onAddChild,
  onMove,
}: WikiTreeItemProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { doc, children } = node;
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(doc.id);
  const isChild = doc.parentId != null;
  // Show "Move Up One Level" only when depth >= 2 (grandparent is a real doc)
  const canMoveUpOneLevel = grandparentId != null;

  const moveTargets = useMemo(() => {
    const descendants = getDescendantIds(doc.id, documents);
    return documents.filter(
      (d) =>
        d.id !== doc.id && // not self
        d.id !== doc.parentId && // not current parent (already there)
        !descendants.has(d.id) // not a descendant (would create cycle)
    );
  }, [doc.id, doc.parentId, documents]);

  const handleSelect = useCallback(() => {
    onSelect(doc.id);
  }, [doc.id, onSelect]);

  const handleDelete = useCallback(async () => {
    await onDelete(doc.id);
  }, [doc.id, onDelete]);

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // prevent row select; actual toggle via Collapsible onOpenChange
    },
    []
  );

  const deleteDescription = hasChildren
    ? "This will delete this document. Its child documents will be moved to the root level."
    : "This will permanently delete this document.";

  const row = (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent",
        activeDocId === doc.id && "bg-muted font-medium"
      )}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect();
        }
      }}
    >
      {hasChildren ? (
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded p-0.5 hover:bg-muted"
            onClick={handleChevronClick}
          >
            <ChevronRightIcon
              className={cn(
                "size-3.5 text-muted-foreground transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          </button>
        </CollapsibleTrigger>
      ) : (
        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
      )}

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
          <DropdownMenuItem onClick={() => onAddChild(doc.id)}>
            <PlusIcon className="mr-2 size-4" />
            Add Child
          </DropdownMenuItem>
          {moveTargets.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <MoveIcon className="mr-2 size-4" />
                Move Into
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-60 overflow-y-auto">
                {moveTargets.map((target) => (
                  <DropdownMenuItem
                    key={target.id}
                    onClick={() => onMove(doc.id, target.id)}
                  >
                    {target.name || "Untitled"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {canMoveUpOneLevel && (
            <DropdownMenuItem onClick={() => onMove(doc.id, grandparentId!)}>
              <CornerLeftUpIcon className="mr-2 size-4" />
              Move Up One Level
            </DropdownMenuItem>
          )}
          {isChild && (
            <DropdownMenuItem onClick={() => onMove(doc.id, null)}>
              <ArrowUpToLineIcon className="mr-2 size-4" />
              Move to Root
            </DropdownMenuItem>
          )}
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
  );

  const childrenContent = hasChildren && (
    <CollapsibleContent>
      <div className="ml-4 border-l pl-2">
        {children.map((child) => (
          <WikiTreeItem
            key={child.doc.id}
            node={child}
            activeDocId={activeDocId}
            expandedIds={expandedIds}
            grandparentId={doc.parentId}
            documents={documents}
            onToggle={onToggle}
            onSelect={onSelect}
            onDelete={onDelete}
            onReorder={onReorder}
            onAddChild={onAddChild}
            onMove={onMove}
          />
        ))}
      </div>
    </CollapsibleContent>
  );

  return (
    <>
      {hasChildren ? (
        <Collapsible open={isExpanded} onOpenChange={() => onToggle(doc.id)}>
          {row}
          {childrenContent}
        </Collapsible>
      ) : (
        row
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete "${doc.name || "Untitled"}"?`}
        description={deleteDescription}
        onConfirm={handleDelete}
      />
    </>
  );
}
