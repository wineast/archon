"use client";

import useSWR from "swr";
import { CalendarIcon, UserIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import type { VersionDetail, AgentSnapshot } from "@/lib/versions/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface VersionDetailSheetProps {
  agentId: string;
  versionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SnapshotSummary({ snapshot }: { snapshot: AgentSnapshot }) {
  const items = [
    { label: "Tools", count: snapshot.tools.length },
    { label: "Functions", count: snapshot.functions.length },
    { label: "Components", count: snapshot.components.length },
    { label: "Schemas", count: snapshot.schemas.length },
    { label: "Wiki", count: snapshot.wikiDocuments.length },
    { label: "Datasets", count: snapshot.datasets.length },
    { label: "Models", count: snapshot.modelConfigs.length },
    { label: "Chat Config", count: snapshot.chatConfig ? 1 : 0 },
    { label: "Eval Cases", count: snapshot.evalCases.length },
    { label: "Judges", count: snapshot.judgeConfigs?.length ?? 0 },
    { label: "Object Types", count: snapshot.objectTypes?.length ?? 0 },
    { label: "Relations", count: snapshot.objectRelations?.length ?? 0 },
  ];

  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Snapshot
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-mono">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VersionDetailSheet({
  agentId,
  versionId,
  open,
  onOpenChange,
}: VersionDetailSheetProps) {
  const { data: detail, isLoading } = useSWR<VersionDetail>(
    versionId ? `/api/agents/${agentId}/versions/${versionId}` : null,
    fetcher
  );

  const snapshot = detail?.snapshot;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          {detail ? (
            <SheetTitle className="font-mono">
              v{detail.version}
            </SheetTitle>
          ) : (
            <SheetTitle>Version Detail</SheetTitle>
          )}
          <SheetDescription className="sr-only">
            Version details
          </SheetDescription>
        </SheetHeader>

        {isLoading || !detail ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-4 px-4">
              {/* Metadata */}
              <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="size-3.5" />
                  <span>{formatDateTime(detail.createdAt)}</span>
                </div>
                {(detail.creatorNickname || detail.creatorEmail) && (
                  <div className="flex items-center gap-2">
                    <UserIcon className="size-3.5" />
                    <span>
                      {detail.creatorNickname || detail.creatorEmail}
                    </span>
                  </div>
                )}
              </div>

              {/* Changelog */}
              {detail.changelog && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Changelog
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {detail.changelog}
                  </p>
                </div>
              )}

              {/* Snapshot summary */}
              {snapshot && <SnapshotSummary snapshot={snapshot} />}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
