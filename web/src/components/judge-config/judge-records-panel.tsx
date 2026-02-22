"use client";

import { useTranslations } from "next-intl";
import { useJudgeRecords } from "@/lib/eval/judge-records-hooks";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { BarChart3Icon } from "lucide-react";

export function JudgeRecordsPanel({ agentId }: { agentId: string }) {
  const t = useTranslations("build");
  const { groups, isLoading } = useJudgeRecords(agentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <BarChart3Icon className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("noJudgeRecords")}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block">
      <div className="space-y-4 p-4">
        {groups.map((group) => (
          <div key={group.agentId} className="rounded-lg border">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <span className="text-sm font-medium">{group.agentName}</span>
              <Badge variant="secondary" className="text-[10px]">
                {group.runs.length} {group.runs.length === 1 ? "run" : "runs"}
              </Badge>
            </div>
            <div className="divide-y">
              {group.runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    {new Date(run.createdAt).toLocaleDateString()}
                  </span>
                  <span className="truncate">{run.chatModel}</span>
                  <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                    {run.passedAssertions}/{run.totalCases} passed
                  </span>
                  {run.averageScore != null && (
                    <Badge variant="outline" className="text-[10px]">
                      {(run.averageScore * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
