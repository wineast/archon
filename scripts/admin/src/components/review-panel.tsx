"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ReviewEntry } from "@/lib/types";
import { marked } from "marked";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function formatTimestamp(ts: string): string {
  // "20260301-143000" → "03-01 14:30"
  const m = ts.match(/^\d{4}(\d{2})(\d{2})-(\d{2})(\d{2})/);
  if (!m) return ts;
  return `${m[1]}-${m[2]} ${m[3]}:${m[4]}`;
}

function extractDecision(html: string): "pass" | "fail" | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const h2s = doc.querySelectorAll("h2");
  for (const h2 of h2s) {
    const txt = h2.textContent ?? "";
    if (txt.includes("\u2705")) return "pass";
    if (txt.includes("\u274C")) return "fail";
  }
  return null;
}

interface ReviewPanelProps {
  reviews: ReviewEntry[];
  worktreeName: string;
}

export function ReviewPanel({ reviews, worktreeName }: ReviewPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("");
  const renderedRef = useRef<Record<string, string>>({});
  const [, forceRender] = useState(0);

  const render = useCallback(() => {
    const rendered: Record<string, string> = {};
    for (const r of reviews) {
      let html = marked.parse(r.content) as string;
      html = html.replace(
        /src="([^"]*\.assets\/[^"]*)"/g,
        `src="/api/reports/${encodeURIComponent(worktreeName)}/assets/$1"`
      );
      rendered[r.filename] = html;
    }
    renderedRef.current = rendered;

    setActiveTab((prev) => {
      if (prev && reviews.some((r) => r.filename === prev)) return prev;
      return reviews.length ? reviews[reviews.length - 1]!.filename : "";
    });

    forceRender((n) => n + 1);
  }, [reviews, worktreeName]);

  useEffect(() => {
    render();
  }, [render]);

  if (reviews.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">暂无评审报告</p>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        {reviews.map((r) => {
          const html = renderedRef.current[r.filename] ?? "";
          const decision = extractDecision(html);
          return (
            <TabsTrigger key={r.filename} value={r.filename}>
              <span>{formatTimestamp(r.timestamp)}</span>
              {decision === "pass" && (
                <span className="ml-1 text-[10px] text-green-600">{"\u2705"}</span>
              )}
              {decision === "fail" && (
                <span className="ml-1 text-[10px] text-red-600">{"\u274C"}</span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {reviews.map((r) => (
        <TabsContent key={r.filename} value={r.filename}>
          <div className="max-h-[700px] overflow-y-auto rounded-b-md border border-t-0 p-5">
            <div
              className="md-content"
              dangerouslySetInnerHTML={{
                __html: renderedRef.current[r.filename] || "",
              }}
            />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
