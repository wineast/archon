"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, GlobeIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideDialog } from "@/components/ui/guide-dialog";
import wikiGuide from "../../../guide/wiki-tree.md";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WikiDocumentWithPool } from "@/lib/wiki/api";
import { WikiTreeItem, type WikiTreeNode } from "./wiki-tree-item";

function buildTree(documents: WikiDocumentWithPool[]): WikiTreeNode[] {
  const map = new Map<string, WikiTreeNode>();
  for (const doc of documents) {
    map.set(doc.id, { doc, children: [] });
  }

  const roots: WikiTreeNode[] = [];
  for (const node of map.values()) {
    const { parentId } = node.doc;
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children at each level by order
  const sortChildren = (nodes: WikiTreeNode[]) => {
    nodes.sort((a, b) => a.doc.order - b.doc.order);
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };
  sortChildren(roots);

  return roots;
}

interface WikiSidebarProps {
  documents: WikiDocumentWithPool[];
  activeDocId: string | null;
  onSelect: (id: string) => void;
  onCreate: (parentId?: string) => void;
  onDelete: (id: string) => Promise<boolean>;
  onReorder: (id: string, direction: "up" | "down") => Promise<void>;
  onMove: (id: string, targetParentId: string | null) => void;
  onAddFromPool?: () => void;
  onRemoveRef?: (refId: string) => void;
}

export function WikiSidebar({
  documents,
  activeDocId,
  onSelect,
  onCreate,
  onDelete,
  onReorder,
  onMove,
  onAddFromPool,
  onRemoveRef,
}: WikiSidebarProps) {
  const t = useTranslations("build");
  const ta = useTranslations("admin");

  const privateDocs = useMemo(() => documents.filter((d) => d._source === "private"), [documents]);
  const poolDocs = useMemo(() => documents.filter((d) => d._source === "pool"), [documents]);

  const tree = useMemo(() => buildTree(privateDocs), [privateDocs]);

  // Default all nodes with children to expanded
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const doc of privateDocs) {
      if (privateDocs.some((d) => d.parentId === doc.id)) {
        ids.add(doc.id);
      }
    }
    return ids;
  });

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleAddChild = useCallback(
    (parentId: string) => {
      // Ensure parent is expanded so child will be visible
      setExpandedIds((prev) => {
        if (prev.has(parentId)) return prev;
        return new Set(prev).add(parentId);
      });
      onCreate(parentId);
    },
    [onCreate]
  );

  const handleMove = useCallback(
    (id: string, targetParentId: string | null) => {
      // Auto-expand target parent so moved doc is visible
      if (targetParentId) {
        setExpandedIds((prev) => {
          if (prev.has(targetParentId)) return prev;
          return new Set(prev).add(targetParentId);
        });
      }
      onMove(id, targetParentId);
    },
    [onMove]
  );

  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">{t("wiki")}</span>
          <GuideDialog title="Wiki 模块" content={wikiGuide} />
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onCreate()}
          title={t("newDocument")}
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="px-0.5 py-0.5">
          {tree.length === 0 && poolDocs.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("noDocuments")}
            </p>
          ) : (
            <>
              {tree.map((node) => (
                <WikiTreeItem
                  key={node.doc.id}
                  node={node}
                  activeDocId={activeDocId}
                  expandedIds={expandedIds}
                  documents={privateDocs}
                  onToggle={handleToggle}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  onReorder={onReorder}
                  onAddChild={handleAddChild}
                  onMove={handleMove}
                />
              ))}

              {poolDocs.length > 0 && (
                <>
                  <div className="mt-2 mb-1 px-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {ta("poolRefs")}
                    </span>
                  </div>
                  {poolDocs.map((doc) => (
                    <div key={doc.id} className="group flex items-center">
                      <button
                        type="button"
                        className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted ${
                          activeDocId === doc.id ? "bg-muted font-medium" : ""
                        }`}
                        onClick={() => onSelect(doc.id)}
                      >
                        <GlobeIcon className="size-3 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-left">{doc.name}</span>
                      </button>
                      {doc._refId && onRemoveRef && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="mr-1 opacity-0 group-hover:opacity-100"
                          onClick={() => onRemoveRef(doc._refId!)}
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
