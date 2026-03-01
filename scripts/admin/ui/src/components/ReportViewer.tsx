import { useState, useRef, useCallback, useEffect } from "react";
import type { ReportData } from "../types";
import { marked } from "marked";

const VERDICT_FAIL_KW = ["驳回", "不足", "\u274C"];
const VERDICT_WARN_KW = ["有条件", "部分", "\u26A0\uFE0F"];

interface ReportViewerProps {
  reportData: ReportData;
  worktreeName: string;
  onVerdict?: (html: string, cls: string) => void;
}

export function ReportViewer({ reportData, worktreeName, onVerdict }: ReportViewerProps) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const renderedReports = useRef<Record<string, string>>({});

  const renderReports = useCallback(() => {
    const rendered: Record<string, string> = {};
    for (const [key, md] of Object.entries(reportData.reports)) {
      if (!md) continue;
      let html = marked.parse(md) as string;
      html = html.replace(
        /src="([^"]*\.assets\/[^"]*)"/g,
        `src="/api/reports/${encodeURIComponent(worktreeName)}/assets/$1"`
      );
      rendered[key] = html;
    }
    renderedReports.current = rendered;

    // Only auto-select tab on initial load or if current tab is no longer available
    const available = reportData.chain.filter((c) => c.available);
    setActiveTab((prev) => {
      if (prev && available.some((c) => c.key === prev)) return prev;
      return available.length ? available[available.length - 1]!.key : null;
    });

    // Extract verdict
    extractVerdict(rendered);
  }, [reportData, worktreeName]);

  useEffect(() => {
    renderReports();
  }, [renderReports]);

  const extractVerdict = (rendered: Record<string, string>) => {
    const src = reportData.verdictSource;
    if (!src || !rendered[src]) {
      onVerdict?.("", "");
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(rendered[src], "text/html");
    const h2s = doc.querySelectorAll("h2");

    for (const h2 of h2s) {
      const txt = h2.textContent?.trim() || "";
      if (txt.includes("Verdict") || txt.includes("裁定")) {
        const nodes: Element[] = [];
        let sib = h2.nextElementSibling;
        while (sib && sib.tagName !== "H2") {
          nodes.push(sib);
          sib = sib.nextElementSibling;
        }
        const verdictText = nodes.map((n) => n.textContent).join(" ");
        const vHtml = nodes.map((n) => n.outerHTML).join("");

        let cls = "verdict-banner verdict-pass";
        if (VERDICT_FAIL_KW.some((k) => verdictText.includes(k))) {
          cls = "verdict-banner verdict-fail";
        } else if (VERDICT_WARN_KW.some((k) => verdictText.includes(k))) {
          cls = "verdict-banner verdict-warn";
        }
        onVerdict?.(vHtml, cls);
        return;
      }
    }
    onVerdict?.("", "");
  };

  const availableChain = reportData.chain.filter((c) => c.available);
  if (availableChain.length === 0) return null;

  return (
    <div className="expanded-reports">
      {/* Tab bar */}
      <div className="report-tab-bar">
        {availableChain.map((c, i) => (
          <button
            key={c.key}
            className={`report-tab-btn${activeTab === c.key ? " active" : ""}`}
            onClick={() => setActiveTab(c.key)}
          >
            <span className={`tab-badge ${c.cssClass}`}>{i + 1}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {availableChain.map((c) => (
        <div
          key={c.key}
          className={`report-tab-panel${activeTab === c.key ? " active" : ""}`}
        >
          <div
            className="panel-body md-content"
            dangerouslySetInnerHTML={{
              __html: renderedReports.current[c.key] || "",
            }}
          />
        </div>
      ))}
    </div>
  );
}
