"use client";

import { useState, useEffect } from "react";
import { fetchFileDiff } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

type DiffSource = "committed" | "staged" | "working" | "untracked";

interface DiffPanelProps {
  worktreeName: string;
  filePath: string;
  source: DiffSource;
  onClose: () => void;
}

interface DiffLine {
  type: "add" | "del" | "ctx" | "hunk" | "header";
  content: string;
  oldNum: number | null;
  newNum: number | null;
}

function parseDiff(raw: string): DiffLine[] {
  if (!raw) return [];
  const lines = raw.split("\n");
  const result: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  let inBody = false;

  for (const line of lines) {
    if (
      line.startsWith("diff --git") ||
      line.startsWith("index ") ||
      line.startsWith("new file") ||
      line.startsWith("deleted file") ||
      line.startsWith("old mode") ||
      line.startsWith("new mode") ||
      line.startsWith("similarity") ||
      line.startsWith("rename") ||
      line.startsWith("Binary file")
    ) {
      result.push({
        type: "header",
        content: line,
        oldNum: null,
        newNum: null,
      });
      continue;
    }
    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      result.push({
        type: "header",
        content: line,
        oldNum: null,
        newNum: null,
      });
      continue;
    }
    if (line.startsWith("@@")) {
      inBody = true;
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1]!, 10);
        newLine = parseInt(match[2]!, 10);
      }
      result.push({
        type: "hunk",
        content: line,
        oldNum: null,
        newNum: null,
      });
      continue;
    }
    if (!inBody) {
      result.push({
        type: "header",
        content: line,
        oldNum: null,
        newNum: null,
      });
      continue;
    }
    if (line.startsWith("+")) {
      result.push({
        type: "add",
        content: line.slice(1),
        oldNum: null,
        newNum: newLine,
      });
      newLine++;
    } else if (line.startsWith("-")) {
      result.push({
        type: "del",
        content: line.slice(1),
        oldNum: oldLine,
        newNum: null,
      });
      oldLine++;
    } else if (line.startsWith("\\")) {
      result.push({
        type: "header",
        content: line,
        oldNum: null,
        newNum: null,
      });
    } else {
      result.push({
        type: "ctx",
        content: line.startsWith(" ") ? line.slice(1) : line,
        oldNum: oldLine,
        newNum: newLine,
      });
      oldLine++;
      newLine++;
    }
  }

  return result;
}

const sourceLabel: Record<DiffSource, string> = {
  committed: "已提交",
  staged: "暂存区",
  working: "工作区",
  untracked: "未跟踪",
};

export function DiffPanel({
  worktreeName,
  filePath,
  source,
  onClose,
}: DiffPanelProps) {
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDiff(null);
    fetchFileDiff(worktreeName, filePath, source)
      .then((data) => setDiff(data.diff))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [worktreeName, filePath, source]);

  const lines = diff ? parseDiff(diff) : [];

  return (
    <div className="overflow-hidden rounded-md border">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted px-3 py-1.5">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="truncate font-mono text-xs font-semibold text-secondary-foreground">
            {filePath}
          </span>
          <span className="shrink-0 text-[10px] font-semibold uppercase text-muted-foreground">
            {sourceLabel[source]}
          </span>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <XIcon className="size-3" />
        </Button>
      </div>

      {/* Body */}
      <div className="max-h-[500px] overflow-auto">
        {loading && (
          <div className="flex items-center justify-center p-6 text-muted-foreground">
            <Spinner />
          </div>
        )}
        {error && (
          <div className="p-3 text-xs text-destructive">{error}</div>
        )}
        {!loading && !error && lines.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No diff
          </div>
        )}
        {!loading && !error && lines.length > 0 && (
          <table className="diff-table">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className={`diff-line-${line.type}`}>
                  <td className="diff-line-num">{line.oldNum ?? ""}</td>
                  <td className="diff-line-num diff-line-num-new">
                    {line.newNum ?? ""}
                  </td>
                  <td className="diff-line-content">
                    <span className="diff-line-prefix">
                      {line.type === "add"
                        ? "+"
                        : line.type === "del"
                          ? "-"
                          : line.type === "ctx"
                            ? " "
                            : ""}
                    </span>
                    {line.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
