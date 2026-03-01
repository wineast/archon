import { useState, useEffect } from "react";
import { fetchFileDiff } from "../api/client";
import { Spinner } from "./Spinner";

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
    if (line.startsWith("diff --git") || line.startsWith("index ") ||
        line.startsWith("new file") || line.startsWith("deleted file") ||
        line.startsWith("old mode") || line.startsWith("new mode") ||
        line.startsWith("similarity") || line.startsWith("rename") ||
        line.startsWith("Binary file")) {
      result.push({ type: "header", content: line, oldNum: null, newNum: null });
      continue;
    }
    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      result.push({ type: "header", content: line, oldNum: null, newNum: null });
      continue;
    }
    if (line.startsWith("@@")) {
      inBody = true;
      // Parse @@ -old,count +new,count @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1]!, 10);
        newLine = parseInt(match[2]!, 10);
      }
      result.push({ type: "hunk", content: line, oldNum: null, newNum: null });
      continue;
    }
    if (!inBody) {
      result.push({ type: "header", content: line, oldNum: null, newNum: null });
      continue;
    }
    if (line.startsWith("+")) {
      result.push({ type: "add", content: line.slice(1), oldNum: null, newNum: newLine });
      newLine++;
    } else if (line.startsWith("-")) {
      result.push({ type: "del", content: line.slice(1), oldNum: oldLine, newNum: null });
      oldLine++;
    } else if (line.startsWith("\\")) {
      // "\ No newline at end of file"
      result.push({ type: "header", content: line, oldNum: null, newNum: null });
    } else {
      // Context line (starts with space or is empty)
      result.push({ type: "ctx", content: line.startsWith(" ") ? line.slice(1) : line, oldNum: oldLine, newNum: newLine });
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

export function DiffPanel({ worktreeName, filePath, source, onClose }: DiffPanelProps) {
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
    <div className="diff-panel">
      <div className="diff-header">
        <div className="diff-header-info">
          <span className="diff-header-path">{filePath}</span>
          <span className="diff-header-source">{sourceLabel[source]}</span>
        </div>
        <button className="btn btn-xs" onClick={onClose}>✕</button>
      </div>
      <div className="diff-body">
        {loading && (
          <div className="diff-loading"><Spinner /></div>
        )}
        {error && (
          <div className="diff-error">{error}</div>
        )}
        {!loading && !error && lines.length === 0 && (
          <div className="diff-empty">No diff</div>
        )}
        {!loading && !error && lines.length > 0 && (
          <table className="diff-table">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className={`diff-line diff-line-${line.type}`}>
                  <td className="diff-line-num diff-line-num-old">
                    {line.oldNum ?? ""}
                  </td>
                  <td className="diff-line-num diff-line-num-new">
                    {line.newNum ?? ""}
                  </td>
                  <td className="diff-line-content">
                    <span className="diff-line-prefix">
                      {line.type === "add" ? "+" : line.type === "del" ? "-" : line.type === "ctx" ? " " : ""}
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
