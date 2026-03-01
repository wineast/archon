import { useState, useMemo } from "react";
import { Spinner } from "./Spinner";
import { DiffPanel } from "./DiffPanel";
import type { StatusData, MergeCheckData, ChangedFile, FileStatusEntry } from "../types";

type DiffSource = "committed" | "staged" | "working" | "untracked";

interface SelectedFile {
  path: string;
  source: DiffSource;
}

interface BranchComparisonProps {
  worktreeName: string;
  statusData: StatusData;
  mergeCheckData: MergeCheckData;
  onSync: () => void;
  onMerge: () => void;
  onGitAdd: () => void;
  onCommit: () => void;
  terminals: string[];
  syncState: "idle" | "running" | "success" | "failed";
  mergeState: "idle" | "running" | "success" | "failed";
  addState: "idle" | "running" | "success" | "failed";
}

// ── Normalized file item for the tree ──

interface FileItem {
  path: string;
  statusLabel: string;
  statusCls: string;
}

// ── Tree node ──

interface TreeNode {
  name: string;       // display name (may be collapsed path like "src/app/api")
  fullPath: string;
  isDir: boolean;
  children: TreeNode[];
  file?: FileItem;    // only for leaf nodes
}

// ── Build tree from flat file list ──

function buildFileTree(items: FileItem[]): TreeNode[] {
  const root: TreeNode = { name: "", fullPath: "", isDir: true, children: [] };

  for (const item of items) {
    const parts = item.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;

      if (isLast) {
        current.children.push({
          name: part,
          fullPath: item.path,
          isDir: false,
          children: [],
          file: item,
        });
      } else {
        let dir = current.children.find((c) => c.isDir && c.name === part);
        if (!dir) {
          dir = { name: part, fullPath: parts.slice(0, i + 1).join("/"), isDir: true, children: [] };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  }

  // Collapse single-child directories (a/b/c → "a/b/c"), skip root
  for (const child of root.children) {
    collapseTree(child);
  }

  // Sort: dirs first, then files, alphabetical within each
  sortTree(root);

  return root.children;
}

function collapseTree(node: TreeNode) {
  for (const child of node.children) {
    collapseTree(child);
  }
  // If this dir has exactly one child and it's also a dir, merge them
  const only = node.children[0];
  if (node.isDir && node.children.length === 1 && only && only.isDir) {
    node.name = node.name ? `${node.name}/${only.name}` : only.name;
    node.fullPath = only.fullPath;
    node.children = only.children;
    // Recurse again in case the merged result can collapse further
    collapseTree(node);
  }
}

function sortTree(node: TreeNode) {
  node.children.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) {
    if (child.isDir) sortTree(child);
  }
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
  const staged = files.filter((f) => f.x !== " " && f.x !== "?");
  return staged.map((f) => {
    const x = f.x;
    let label = "修改";
    if (x === "A") label = "新增";
    else if (x === "D") label = "删除";
    else if (x === "R") label = "重命名";
    else if (x === "M") label = "修改";
    return { path: f.path, statusLabel: label, statusCls: diffCls(x) };
  });
}

function normalizeWorking(files: FileStatusEntry[]): FileItem[] {
  const working = files.filter((f) => f.y !== " " && f.y !== "?" && f.x !== "?");
  return working.map((f) => ({
    path: f.path,
    statusLabel: f.y === "D" ? "删除" : "修改",
    statusCls: "file-modified",
  }));
}

function normalizeUntracked(files: FileStatusEntry[]): FileItem[] {
  const untracked = files.filter((f) => f.x === "?" && f.y === "?");
  return untracked.map((f) => ({
    path: f.path,
    statusLabel: "新文件",
    statusCls: "file-added",
  }));
}

function normalizeChanged(files: ChangedFile[]): FileItem[] {
  return files.map((f) => ({
    path: f.path,
    statusLabel: diffLabel(f.status),
    statusCls: diffCls(f.status),
  }));
}

// ── FileTree component ──

interface FileTreeViewProps {
  items: FileItem[];
  title: string;
  action?: React.ReactNode;
  source: DiffSource;
  selectedFile: SelectedFile | null;
  onFileClick: (path: string, source: DiffSource) => void;
}

function FileTreeView({ items, title, action, source, selectedFile, onFileClick }: FileTreeViewProps) {
  const tree = useMemo(() => buildFileTree(items), [items]);

  if (items.length === 0) return null;

  return (
    <div className="git-file-section">
      <div className="git-file-section-header">
        <span className="git-file-section-title">{title} ({items.length})</span>
        {action}
      </div>
      <div className="git-file-list">
        {tree.map((node) => (
          <FileTreeNode
            key={node.fullPath}
            node={node}
            depth={0}
            source={source}
            selectedFile={selectedFile}
            onFileClick={onFileClick}
          />
        ))}
      </div>
    </div>
  );
}

interface FileTreeNodeProps {
  node: TreeNode;
  depth: number;
  source: DiffSource;
  selectedFile: SelectedFile | null;
  onFileClick: (path: string, source: DiffSource) => void;
}

function FileTreeNode({ node, depth, source, selectedFile, onFileClick }: FileTreeNodeProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!node.isDir) {
    const isSelected = selectedFile?.path === node.file?.path && selectedFile?.source === source;
    return (
      <div
        className={`git-file-item ft-file-clickable ${node.file?.statusCls ?? ""} ${isSelected ? "ft-file-selected" : ""}`}
        style={{ paddingLeft: `${14 + depth * 20}px` }}
        onClick={() => node.file && onFileClick(node.file.path, source)}
      >
        <span className="ft-icon">📄</span>
        <span className="git-file-path">{node.name}</span>
        <span className="git-file-status">{node.file?.statusLabel}</span>
      </div>
    );
  }

  return (
    <>
      <div
        className="git-file-item ft-dir"
        style={{ paddingLeft: `${14 + depth * 20}px` }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className={`ft-chevron ${collapsed ? "" : "ft-chevron-open"}`}>›</span>
        <span className="ft-icon">📁</span>
        <span className="ft-dir-name">{node.name}</span>
      </div>
      {!collapsed &&
        node.children.map((child) => (
          <FileTreeNode
            key={child.fullPath}
            node={child}
            depth={depth + 1}
            source={source}
            selectedFile={selectedFile}
            onFileClick={onFileClick}
          />
        ))}
    </>
  );
}

// ── Main component ──

export function BranchComparison({
  worktreeName,
  statusData,
  mergeCheckData,
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
  const upstreamDirty = (upstream.staged || 0) + (upstream.unstaged || 0) > 0;
  const currentDirty = (current.staged || 0) + (current.unstaged || 0) > 0;

  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  const handleFileClick = (path: string, source: DiffSource) => {
    if (selectedFile?.path === path && selectedFile?.source === source) {
      setSelectedFile(null);
    } else {
      setSelectedFile({ path, source });
    }
  };

  const stagedItems = useMemo(() => normalizeStaged(files), [files]);
  const workingItems = useMemo(() => normalizeWorking(files), [files]);
  const untrackedItems = useMemo(() => normalizeUntracked(files), [files]);
  const changedItems = useMemo(() => normalizeChanged(changedFiles), [changedFiles]);

  const addBtn = (
    <button className="btn btn-xs" disabled={addState === "running"} onClick={onGitAdd} title="git add">
      {addState === "running" ? <Spinner /> : null}
      <span>add</span>
    </button>
  );

  return (
    <div className="branch-comparison">
      {/* 1. Branch comparison header */}
      <div className="branch-compare-header">
        <div className="branch-compare-side">
          <span className="branch-compare-label">base</span>
          <span className="git-branch-name">{baseBranch}</span>
          {upstreamDirty && <span className="dirty-badge" title="上游有未提交变更">dirty</span>}
        </div>
        <span className="branch-compare-arrow">...</span>
        <div className="branch-compare-side">
          <span className="branch-compare-label">head</span>
          <span className="git-branch-name">{headBranch}</span>
          {currentDirty && <span className="dirty-badge" title="工作区有未提交变更">dirty</span>}
        </div>
        <div className="branch-compare-badges">
          {current.ahead > 0 && (
            <span className="git-badge ahead">+{current.ahead}</span>
          )}
          {current.behind > 0 && (
            <span className="git-badge behind">-{current.behind}</span>
          )}
        </div>
      </div>

      {/* 2. Working tree status */}
      <FileTreeView items={stagedItems} title="暂存区" source="staged" selectedFile={selectedFile} onFileClick={handleFileClick} action={
        <button className="btn btn-xs" onClick={onCommit} title="AI 提交">
          {terminals.includes("/commit") ? "✦ 提交中…" : "✦ commit"}
        </button>
      } />
      <FileTreeView items={workingItems} title="工作区" source="working" selectedFile={selectedFile} onFileClick={handleFileClick} action={addBtn} />
      <FileTreeView items={untrackedItems} title="未跟踪" source="untracked" selectedFile={selectedFile} onFileClick={handleFileClick} action={addBtn} />

      {/* 3. Commit list */}
      {commits.length > 0 && (
        <>
          <div className="commits-header">
            <span className="commits-title">提交</span>
            <span className="commits-count">{commits.length}</span>
          </div>
          <div className="commits-list">
            {commits.map((c, i) => (
              <div key={i} className="commit-row">
                <span className="commit-hash">{c.hash.slice(0, 7)}</span>
                <span className="commit-subject">{c.subject}</span>
                <span className="commit-meta">{c.date}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 4. Changed files (committed vs base) */}
      <FileTreeView items={changedItems} title="已提交变更" source="committed" selectedFile={selectedFile} onFileClick={handleFileClick} />

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
      <div className="branch-compare-footer">
        <MergeStatusHint status={mergeStatus} message={mergeCheckData.message} />
        <div className="branch-compare-actions">
          {mergeStatus === "behind" && (
            <button
              className="btn btn-sm btn-sync"
              disabled={isBusy}
              onClick={onSync}
            >
              {syncState === "running" && <Spinner />}
              <span>同步</span>
            </button>
          )}
          {mergeStatus === "clean" && (
            <button
              className="btn btn-sm btn-merge"
              disabled={isBusy}
              onClick={onMerge}
            >
              {mergeState === "running" && <Spinner />}
              <span>合并</span>
            </button>
          )}
          {mergeStatus === "conflict" && (
            <button className="btn btn-sm btn-merge" disabled>
              <span>合并</span>
            </button>
          )}
        </div>
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
    clean: { icon: "\u2713", cls: "status-clean", fallback: "可以合并，无冲突" },
    behind: { icon: "\u26A0", cls: "status-behind", fallback: "落后上游，请先同步" },
    conflict: { icon: "\u2717", cls: "status-conflict", fallback: "存在合并冲突，请手动解决" },
    dirty: { icon: "\u26A0", cls: "status-behind", fallback: "有未提交的变更，请先提交" },
    up_to_date: { icon: "\u2139", cls: "status-uptodate", fallback: "分支已是最新" },
    merged: { icon: "\u2713", cls: "status-merged", fallback: "已合并" },
  };

  const fallback = { icon: "\u2139", cls: "status-uptodate", fallback: "分支已是最新" };
  const c = config[status] ?? fallback;

  return (
    <div className={`branch-compare-status ${c.cls}`}>
      <span className="branch-compare-status-icon">{c.icon}</span>
      <span>{message || c.fallback}</span>
    </div>
  );
}
