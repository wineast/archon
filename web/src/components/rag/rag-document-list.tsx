"use client";

import { useCallback, useRef, useState } from "react";
import {
  FileTextIcon,
  PlusIcon,
  Trash2Icon,
  AlertCircleIcon,
  CheckCircle2Icon,
  Loader2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { RagDocumentRow } from "@/db/schema";

interface RagDocumentListProps {
  documents: RagDocumentRow[];
  onUpload: (file: File) => Promise<unknown>;
  onDelete: (id: string) => Promise<boolean>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ready":
      return (
        <span className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2Icon className="size-3" />
          Ready
        </span>
      );
    case "processing":
      return (
        <span className="flex items-center gap-1 text-xs text-yellow-600">
          <Loader2Icon className="size-3 animate-spin" />
          Processing
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircleIcon className="size-3" />
          Error
        </span>
      );
    default:
      return null;
  }
}

export function RagDocumentList({
  documents,
  onUpload,
  onDelete,
}: RagDocumentListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RagDocumentRow | null>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      await onUpload(file);
      setUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [onUpload]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const ok = await onDelete(deleteTarget.id);
    if (ok) setDeleteTarget(null);
  }, [deleteTarget, onDelete]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        {documents.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
            暂无文档
          </div>
        ) : (
          <div className="divide-y">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatSize(doc.size)}</span>
                    {doc.status === "ready" && (
                      <span>{doc.chunkCount} chunks</span>
                    )}
                    {doc.status === "error" && doc.error && (
                      <span className="truncate text-destructive" title={doc.error}>
                        {doc.error}
                      </span>
                    )}
                  </div>
                </div>
                <StatusBadge status={doc.status} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() => setDeleteTarget(doc)}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="flex items-center gap-2 border-t px-4 py-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Spinner className="mr-1.5 size-4" />
          ) : (
            <PlusIcon className="mr-1.5 size-4" />
          )}
          {uploading ? "Uploading..." : "上传文档"}
        </Button>
        <span className="text-xs text-muted-foreground">
          PDF / TXT / DOCX, 最大 10MB
        </span>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Document"
        description={`确认删除文档 "${deleteTarget?.name}"？关联的分块数据也将被删除。`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
