"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ReportData } from "@/lib/types";
import { marked } from "marked";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const VERDICT_FAIL_KW = ["驳回", "不足", "\u274C"];
const VERDICT_WARN_KW = ["有条件", "部分", "\u26A0\uFE0F"];

interface ReportViewerProps {
  reportData: ReportData;
  worktreeName: string;
  onVerdict?: (html: string, cls: string) => void;
}

export function ReportViewer({
  reportData,
  worktreeName,
  onVerdict,
}: ReportViewerProps) {
  const [activeTab, setActiveTab] = useState<string>("");
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

    const available = reportData.chain.filter((c) => c.available);
    setActiveTab((prev) => {
      if (prev && available.some((c) => c.key === prev)) return prev;
      return available.length ? available[available.length - 1]!.key : "";
    });

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
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        {availableChain.map((c, i) => (
          <TabsTrigger key={c.key} value={c.key}>
            <span
              className={`chain-node-${c.cssClass} inline-flex size-5 items-center justify-center rounded-full text-[9px] font-bold`}
            >
              {i + 1}
            </span>
            <span>{c.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {availableChain.map((c) => (
        <TabsContent key={c.key} value={c.key}>
          <div className="max-h-[700px] overflow-y-auto rounded-b-md border border-t-0 p-5">
            <div
              className="md-content"
              dangerouslySetInnerHTML={{
                __html: renderedReports.current[c.key] || "",
              }}
            />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
