"use client";

import { useState, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { DiffPanel } from "./diff-panel";
import { FileTreeView, type FileItem } from "./file-tree";
import type {
  StatusData,
  MergeCheckData,
  ChangedFile,
  FileStatusEntry,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type DiffSource = "committed" | "staged" | "working" | "untracked";

interface SelectedFile {
  path: string;
  source: DiffSource;
}

interface BranchComparisonProps {
  worktreeName: string;
  statusData: StatusData;
  mergeCheckData: MergeCheckData;
  readOnly?: boolean;
  onSync: () => void;
  onMerge: () => void;
  onGitAdd: () => void;
  onCommit: () => void;
  terminals: string[];
  syncState: "idle" | "running" | "success" | "failed";
  mergeState: "idle" | "running" | "success" | "failed";
  addState: "idle" | "running" | "success" | "failed";
}

// ── Helpers ──

const diffLabel = (s: string) => {
  if (s === "A") return "新增";
  if (s === "D") return "删除";
  if (s.startsWith("R")) return "重命名";
  return "修改";
};

const diffCls = (s: string) => {
  if (s === "A") return "file-added";
  if (s === "D") return "file-deleted";
  if (s.startsWith("R")) return "file-renamed";
  return "file-modified";
};

function normalizeStaged(files: FileStatusEntry[]): FileItem[] {
  return files
    .filter((f) => f.x !== " " && f.x !== "?")
    .map((f) => {
      const x = f.x;
      let label = "修改";
      if (x === "A") label = "新增";
      else if (x === "D") label = "删除";
      else if (x === "R") label = "重命名";
      return { path: f.path, statusLabel: label, statusCls: diffCls(x) };
    });
}

function normalizeWorking(files: FileStatusEntry[]): FileItem[] {
  return files
    .filter((f) => f.y !== " " && f.y !== "?" && f.x !== "?")
    .map((f) => ({
      path: f.path,
      statusLabel: f.y === "D" ? "删除" : "修改",
      statusCls: "file-modified",
    }));
}

function normalizeUntracked(files: FileStatusEntry[]): FileItem[] {
  return files
    .filter((f) => f.x === "?" && f.y === "?")
    .map((f) => ({
      path: f.path,
      statusLabel: "新文件",
      statusCls: "file-added",
      source: "untracked" as const,
    }));
}

function normalizeChanged(files: ChangedFile[]): FileItem[] {
  return files.map((f) => ({
    path: f.path,
    statusLabel: diffLabel(f.status),
    statusCls: diffCls(f.status),
  }));
}

// ── Main component ──

export function BranchComparison({
  worktreeName,
  statusData,
  mergeCheckData,
  readOnly = false,
  onSync,
  onMerge,
  onGitAdd,
  onCommit,
  terminals,
  syncState,
  mergeState,
  addState,
}: BranchComparisonProps) {
  const { upstream, current, commits, changedFiles, files = [] } = statusData;
  const baseBranch = upstream.branch || "dev";
  const headBranch = current.branch;

  const mergeStatus = mergeCheckData.status;
  const isBusy = syncState === "running" || mergeState === "running";
  const upstreamDirty =
    (upstream.staged || 0) + (upstream.unstaged || 0) > 0;
  const currentDirty =
    (current.staged || 0) + (current.unstaged || 0) > 0;

  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  const handleFileClick = (path: string, source: DiffSource) => {
    if (selectedFile?.path === path && selectedFile?.source === source) {
      setSelectedFile(null);
    } else {
      setSelectedFile({ path, source });
    }
  };

  const stagedItems = useMemo(() => normalizeStaged(files), [files]);
  const workingItems = useMemo(
    () => [...normalizeWorking(files), ...normalizeUntracked(files)],
    [files]
  );
  const changedItems = useMemo(
    () => normalizeChanged(changedFiles),
    [changedFiles]
  );

  const addBtn = (
    <Button
      variant="outline"
      size="xs"
      disabled={addState === "running"}
      onClick={onGitAdd}
    >
      {addState === "running" && <Spinner className="size-3" />}
      <span>add</span>
    </Button>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Branch comparison header */}
      <div className="flex items-center gap-3 rounded-md border p-2.5 px-3.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            base
          </span>
          <span className="font-mono text-[13px] font-semibold text-primary">
            {baseBranch}
          </span>
          {upstreamDirty && (
            <span
              className="rounded-full bg-[#fef8e7] px-1.5 py-px text-[10px] font-semibold text-[#9a6700]"
              title="上游有未提交变更"
            >
              dirty
            </span>
          )}
        </div>
        <span className="font-mono text-sm text-muted-foreground">...</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            head
          </span>
          <span className="font-mono text-[13px] font-semibold text-primary">
            {headBranch}
          </span>
          {currentDirty && (
            <span
              className="rounded-full bg-[#fef8e7] px-1.5 py-px text-[10px] font-semibold text-[#9a6700]"
              title="工作区有未提交变更"
            >
              dirty
            </span>
          )}
        </div>
        <div className="ml-auto flex gap-1.5">
          {current.ahead > 0 && (
            <span className="rounded-full bg-[#e7f7ef] px-1.5 py-px text-[11px] font-semibold text-[#18794e]">
              +{current.ahead}
            </span>
          )}
          {current.behind > 0 && (
            <span className="rounded-full bg-[#fef0ee] px-1.5 py-px text-[11px] font-semibold text-[#c4321d]">
              -{current.behind}
            </span>
          )}
        </div>
      </div>

      {/* 2. Working tree status */}
      <FileTreeView
        items={stagedItems}
        title="暂存区"
        source="staged"
        selectedFile={selectedFile}
        onFileClick={handleFileClick}
        action={
          !readOnly ? (
            <Button variant="outline" size="xs" onClick={onCommit}>
              <span>
                {terminals.includes("/commit")
                  ? "\u2726 提交中\u2026"
                  : "\u2726 commit"}
              </span>
            </Button>
          ) : undefined
        }
      />
      <FileTreeView
        items={workingItems}
        title="工作区"
        source="working"
        selectedFile={selectedFile}
        onFileClick={handleFileClick}
        action={!readOnly ? addBtn : undefined}
      />

      {/* 3. Commit list */}
      {commits.length > 0 && (
        <>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              提交
            </span>
            <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-primary">
              {commits.length}
            </span>
          </div>
          <div className="overflow-hidden rounded-md border">
            {commits.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 border-b border-border/50 px-3.5 py-2 text-[13px] last:border-b-0 hover:bg-muted/50"
              >
                <span className="whitespace-nowrap rounded bg-accent px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                  {c.hash.slice(0, 7)}
                </span>
                <span className="flex-1 truncate text-secondary-foreground">
                  {c.subject}
                </span>
                <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                  {c.date}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 4. Changed files (committed vs base) */}
      <FileTreeView
        items={changedItems}
        title="已提交变更"
        source="committed"
        selectedFile={selectedFile}
        onFileClick={handleFileClick}
      />

      {/* 4.5. Diff panel */}
      {selectedFile && (
        <DiffPanel
          worktreeName={worktreeName}
          filePath={selectedFile.path}
          source={selectedFile.source}
          onClose={() => setSelectedFile(null)}
        />
      )}

      {/* 5. Merge action bar */}
      <div className="flex items-center justify-between gap-3 rounded-md border p-2.5 px-3.5">
        <MergeStatusHint
          status={mergeStatus}
          message={mergeCheckData.message}
        />
        {!readOnly && (
          <div className="flex gap-2">
            {mergeStatus === "behind" && (
              <Button
                variant="sync"
                size="sm"
                disabled={isBusy}
                onClick={onSync}
              >
                {syncState === "running" && <Spinner className="size-3" />}
                <span>同步</span>
              </Button>
            )}
            {mergeStatus === "clean" && (
              <Button
                variant="merge"
                size="sm"
                disabled={isBusy}
                onClick={onMerge}
              >
                {mergeState === "running" && <Spinner className="size-3" />}
                <span>合并</span>
              </Button>
            )}
            {mergeStatus === "conflict" && (
              <Button variant="merge" size="sm" disabled>
                <span>合并</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MergeStatusHint({
  status,
  message,
}: {
  status: MergeCheckData["status"];
  message: string;
}) {
  const config: Record<
    string,
    { icon: string; cls: string; fallback: string }
  > = {
    clean: {
      icon: "\u2713",
      cls: "text-[#18794e]",
      fallback: "可以合并，无冲突",
    },
    behind: {
      icon: "\u26A0",
      cls: "text-[#9a6700]",
      fallback: "落后上游，请先同步",
    },
    conflict: {
      icon: "\u2717",
      cls: "text-destructive",
      fallback: "存在合并冲突，请手动解决",
    },
    dirty: {
      icon: "\u26A0",
      cls: "text-[#9a6700]",
      fallback: "有未提交的变更，请先提交",
    },
    up_to_date: {
      icon: "\u2139",
      cls: "text-muted-foreground",
      fallback: "分支已是最新",
    },
    merged: {
      icon: "\u2713",
      cls: "text-[#18794e]",
      fallback: "已合并",
    },
  };

  const fallback = {
    icon: "\u2139",
    cls: "text-muted-foreground",
    fallback: "分支已是最新",
  };
  const c = config[status] ?? fallback;

  return (
    <div className={cn("flex items-center gap-1.5 text-[13px]", c.cls)}>
      <span className="text-sm leading-none">{c.icon}</span>
      <span>{message || c.fallback}</span>
    </div>
  );
}
