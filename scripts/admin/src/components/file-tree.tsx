"use client";

import { useState, useMemo } from "react";
import { ChevronRightIcon, FileIcon, FolderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type DiffSource = "committed" | "staged" | "working" | "untracked";

export interface FileItem {
  path: string;
  statusLabel: string;
  statusCls: string;
  source?: DiffSource;
}

interface SelectedFile {
  path: string;
  source: DiffSource;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  children: TreeNode[];
  file?: FileItem;
}

// ── Build tree from flat file list ──

function buildFileTree(items: FileItem[]): TreeNode[] {
  const root: TreeNode = {
    name: "",
    fullPath: "",
    isDir: true,
    children: [],
  };

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
          dir = {
            name: part,
            fullPath: parts.slice(0, i + 1).join("/"),
            isDir: true,
            children: [],
          };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  }

  for (const child of root.children) {
    collapseTree(child);
  }
  sortTree(root);
  return root.children;
}

function collapseTree(node: TreeNode) {
  for (const child of node.children) {
    collapseTree(child);
  }
  const only = node.children[0];
  if (node.isDir && node.children.length === 1 && only && only.isDir) {
    node.name = node.name ? `${node.name}/${only.name}` : only.name;
    node.fullPath = only.fullPath;
    node.children = only.children;
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

// ── FileTree component ──

interface FileTreeViewProps {
  items: FileItem[];
  title: string;
  action?: React.ReactNode;
  source: DiffSource;
  selectedFile: SelectedFile | null;
  onFileClick: (path: string, source: DiffSource) => void;
}

export function FileTreeView({
  items,
  title,
  action,
  source,
  selectedFile,
  onFileClick,
}: FileTreeViewProps) {
  const tree = useMemo(() => buildFileTree(items), [items]);

  if (items.length === 0) return null;

  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-center justify-between py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title} ({items.length})
        </span>
        {action}
      </div>
      <div className="max-h-[400px] overflow-hidden overflow-y-auto rounded-md border">
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

function FileTreeNode({
  node,
  depth,
  source,
  selectedFile,
  onFileClick,
}: FileTreeNodeProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!node.isDir) {
    const effectiveSource = node.file?.source ?? source;
    const isSelected =
      selectedFile?.path === node.file?.path &&
      selectedFile?.source === effectiveSource;
    return (
      <div
        className={cn(
          "flex cursor-pointer items-center gap-1.5 border-b border-border/50 px-3.5 py-1 text-[13px] transition-colors last:border-b-0",
          isSelected ? "bg-accent" : "hover:bg-muted/50"
        )}
        style={{ paddingLeft: `${14 + depth * 20}px` }}
        onClick={() => node.file && onFileClick(node.file.path, effectiveSource)}
      >
        <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono text-xs text-secondary-foreground">
          {node.name}
        </span>
        <span
          className={cn(
            "ml-auto shrink-0 text-[10px] font-semibold uppercase",
            node.file?.statusCls
          )}
        >
          {node.file?.statusLabel}
        </span>
      </div>
    );
  }

  return (
    <>
      <div
        className="flex cursor-pointer items-center gap-1.5 border-b border-border/50 px-3.5 py-1 text-[13px] select-none last:border-b-0 hover:bg-muted/50"
        style={{ paddingLeft: `${14 + depth * 20}px` }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <ChevronRightIcon
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            !collapsed && "rotate-90"
          )}
        />
        <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-mono text-xs font-semibold text-secondary-foreground">
          {node.name}
        </span>
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
