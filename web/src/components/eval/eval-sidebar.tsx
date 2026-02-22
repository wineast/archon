"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GuideDialog } from "@/components/ui/guide-dialog";
import evalGuide from "../../../guide/eval.md";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EvalCaseRow } from "@/db/schema";
import {
  BarChart3Icon,
  FlaskConicalIcon,
  PlusIcon,
  TrendingUpIcon,
} from "lucide-react";

export type ActiveView =
  | { type: "case"; id: string }
  | { type: "results" }
  | { type: "benchmark" }
  | null;

interface EvalSidebarProps {
  cases: EvalCaseRow[];
  activeView: ActiveView;
  onSelect: (view: ActiveView) => void;
  onCreateCase: () => void;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

export function EvalSidebar({
  cases,
  activeView,
  onSelect,
  onCreateCase,
  selectedTags,
  onToggleTag,
}: EvalSidebarProps) {
  const t = useTranslations("build");
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    cases.forEach((c) => c.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [cases]);

  const filteredCases = useMemo(() => {
    if (selectedTags.length === 0) return cases;
    return cases.filter((c) =>
      selectedTags.some((t) => c.tags?.includes(t))
    );
  }, [cases, selectedTags]);

  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        {/* Cases section */}
        <div className="border-b">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-1.5">
              <FlaskConicalIcon className="size-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold">{t("evalCases")}</span>
              <GuideDialog title="评测模块" content={evalGuide} />
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onCreateCase}
              title={t("newCase")}
            >
              <PlusIcon className="size-4" />
            </Button>
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1 px-3 pb-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => onToggleTag(tag)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                    selectedTags.includes(tag)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          <div className="p-1">
            {filteredCases.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                {cases.length === 0 ? t("noCases") : t("noMatchingCases")}
              </p>
            ) : (
              filteredCases.map((c) => (
                <button
                  key={c.id}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent ${
                    activeView?.type === "case" && activeView.id === c.id
                      ? "bg-accent"
                      : ""
                  }`}
                  onClick={() => onSelect({ type: "case", id: c.id })}
                >
                  <span className="flex-1 truncate">{c.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {c.assertions.length}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Results & Benchmark entries - fixed at bottom */}
      <div className="border-t p-2 space-y-0.5">
        <button
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
            activeView?.type === "results" ? "bg-accent" : ""
          }`}
          onClick={() => onSelect({ type: "results" })}
        >
          <BarChart3Icon className="size-4 text-muted-foreground" />
          <span>{t("results")}</span>
        </button>
        <button
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
            activeView?.type === "benchmark" ? "bg-accent" : ""
          }`}
          onClick={() => onSelect({ type: "benchmark" })}
        >
          <TrendingUpIcon className="size-4 text-muted-foreground" />
          <span>{t("benchmark")}</span>
        </button>
      </div>
    </div>
  );
}
