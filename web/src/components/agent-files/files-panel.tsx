"use client";

import { useRef, useState } from "react";
import { FileIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useAgentFiles,
  uploadAgentFile,
  deleteAgentFile,
} from "@/lib/agent-files/hooks";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string | Date) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FilesPanel({ agentId }: { agentId: string }) {
  const { files, isLoading, mutate } = useAgentFiles(agentId);
  const [busy, setBusy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("upload");
    await uploadAgentFile(agentId, file, mutate);
    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleDelete(fileId: string) {
    setBusy(fileId);
    await deleteAgentFile(agentId, fileId, mutate);
    setBusy(null);
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="min-h-0 flex-1">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
            <FileIcon className="size-10 opacity-30" />
            <p className="text-sm">No files uploaded yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Size</th>
                <th className="px-4 py-2 font-medium">Uploaded</th>
                <th className="w-12 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2">
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {f.name}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatSize(f.size)}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatDate(f.createdAt)}
                  </td>
                  <td className="px-4 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={busy !== null}
                      onClick={() => handleDelete(f.id)}
                    >
                      {busy === f.id ? (
                        <Spinner className="size-3.5" />
                      ) : (
                        <Trash2Icon className="size-3.5" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ScrollArea>

      {/* Bottom action bar */}
      <div className="flex shrink-0 items-center justify-end gap-2 p-4">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          size="sm"
          disabled={busy !== null}
          onClick={() => inputRef.current?.click()}
        >
          {busy === "upload" ? (
            <Spinner className="size-4" />
          ) : (
            <UploadIcon className="size-4" />
          )}
          Upload PDF
        </Button>
      </div>
    </div>
  );
}
