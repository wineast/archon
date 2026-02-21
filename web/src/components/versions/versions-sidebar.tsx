"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircleIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  PlusIcon,
  RocketIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { VersionListItem } from "@/lib/versions/types";

interface VersionsSidebarProps {
  versions: VersionListItem[];
  latestVersion: string | null;
  editingVersionId: string | null;
  publishedVersionId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onViewDetail: (id: string) => void;
  onPublish: (id: string) => void;
  onRollback: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function VersionsSidebar({
  versions,
  latestVersion,
  editingVersionId,
  publishedVersionId,
  onSelect,
  onCreate,
  onViewDetail,
  onPublish,
  onRollback,
  onDelete,
}: VersionsSidebarProps) {
  const t = useTranslations("build");
  const [deleteTarget, setDeleteTarget] = useState<VersionListItem | null>(
    null
  );

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    await onDelete(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <>
      <div className="flex h-full w-48 flex-col overflow-hidden border-r">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-1.5">
            <TagIcon className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              {latestVersion ? `v${latestVersion}` : t("unpublished")}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onCreate}
            title={t("newVersion")}
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>

        {/* Version list */}
        <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
          <div className="p-1">
            {versions.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                {t("noVersions")}
              </p>
            ) : (
              versions.map((v) => {
                const isEditing = editingVersionId === v.id;
                const isPublished = publishedVersionId === v.id;
                return (
                  <div
                    key={v.id}
                    className={cn(
                      "group flex items-center gap-0.5 rounded-md pr-0.5 transition-colors hover:bg-accent",
                      isEditing && "bg-accent"
                    )}
                  >
                    <button
                      onClick={() => onSelect(v.id)}
                      className="flex min-w-0 flex-1 flex-col px-2.5 py-1.5 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium font-mono">
                          v{v.version}
                        </span>
                        {isPublished && (
                          <CheckCircleIcon className="size-3 shrink-0 text-green-600 dark:text-green-400" />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(v.createdAt)}
                      </span>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                        >
                          <EllipsisVerticalIcon className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => onViewDetail(v.id)}>
                          <EyeIcon className="mr-2 size-3.5" />
                          {t("detail")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onPublish(v.id)}
                          disabled={isPublished}
                        >
                          <RocketIcon className="mr-2 size-3.5" />
                          {t("publish")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(v)}
                          disabled={isPublished}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2Icon className="mr-2 size-3.5" />
                          {t("deleteVersion")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("deleteVersion")}
        description={`Are you sure you want to delete v${deleteTarget?.version}? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
