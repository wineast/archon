"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GuideDialog } from "@/components/ui/guide-dialog";
import runtimeEventsGuide from "../../../guide/runtime-events.md";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useRuntimeEvents } from "@/lib/runtime-events/hooks";
import {
  runtimeEventTypes,
  runtimeEventSeverities,
} from "@/db/schema";
import type {
  RuntimeEventType,
  RuntimeEventSeverity,
  RuntimeEventRow,
} from "@/db/schema";

interface RuntimeEventsPanelProps {
  agentId: string;
}

const EVENT_TYPE_LABELS: Record<RuntimeEventType, string> = {
  llm_call: "LLM 调用",
  tool_call: "工具调用",
  tool_error: "工具错误",
  tool_timeout: "工具超时",
  tool_output_validation: "输出校验",
  stream_error: "流错误",
};

const SEVERITY_LABELS: Record<RuntimeEventSeverity, string> = {
  info: "Info",
  warning: "Warning",
  error: "Error",
};

const SEVERITY_VARIANT: Record<RuntimeEventSeverity, "secondary" | "outline" | "destructive"> = {
  info: "secondary",
  warning: "outline",
  error: "destructive",
};

type DateRange = "7d" | "30d" | "all";

function getDateRange(range: DateRange): { from: string | null; to: string | null } {
  if (range === "all") return { from: null, to: null };
  const now = new Date();
  const days = range === "7d" ? 7 : 30;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: null };
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function EventMetadataDetail({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata) return null;
  const entries = Object.entries(metadata).filter(
    ([k]) => !["toolName", "modelId"].includes(k)
  );
  if (entries.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {entries.map(([key, value]) => (
        <span key={key}>
          {key}: {typeof value === "number" ? value.toLocaleString() : String(value ?? "-")}
        </span>
      ))}
    </div>
  );
}

function EventRow({ event }: { event: RuntimeEventRow }) {
  const meta = event.metadata as Record<string, unknown> | null;
  const label =
    (meta?.toolName as string) ??
    (meta?.modelId as string) ??
    EVENT_TYPE_LABELS[event.eventType];

  return (
    <div className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-accent/50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant={SEVERITY_VARIANT[event.severity]} className="text-[10px] px-1.5 py-0">
            {event.severity}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {EVENT_TYPE_LABELS[event.eventType]}
          </Badge>
          <span className="text-sm font-medium truncate">{label}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatDuration(event.durationMs)}
          </span>
        </div>
        <EventMetadataDetail metadata={meta} />
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatTime(event.createdAt as unknown as string)}
        </p>
      </div>
    </div>
  );
}

export function RuntimeEventsPanel({ agentId }: RuntimeEventsPanelProps) {
  const [eventType, setEventType] = useState<RuntimeEventType | null>(null);
  const [severity, setSeverity] = useState<RuntimeEventSeverity | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("7d");

  const { from, to } = useMemo(() => getDateRange(dateRange), [dateRange]);

  const { items, isLoading, isLoadingMore, hasMore, loadMore } =
    useRuntimeEvents({
      agentId,
      eventType,
      severity,
      from,
      to,
    });

  // Intersection observer for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setupObserver = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }
  }, [hasMore, isLoadingMore, loadMore]);

  useEffect(() => {
    setupObserver();
    return () => observerRef.current?.disconnect();
  }, [setupObserver]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="text-sm font-semibold">Runtime</span>
        <GuideDialog title="运行时事件" content={runtimeEventsGuide} />
        <div className="flex-1" />
      </div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 p-4 pb-2">
        <Select
          value={dateRange}
          onValueChange={(v) => setDateRange(v as DateRange)}
        >
          <SelectTrigger className="h-8 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">近 7 天</SelectItem>
            <SelectItem value="30d">近 30 天</SelectItem>
            <SelectItem value="all">全部</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={eventType ?? "__all__"}
          onValueChange={(v) =>
            setEventType(v === "__all__" ? null : (v as RuntimeEventType))
          }
        >
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="全部类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部类型</SelectItem>
            {runtimeEventTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {EVENT_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={severity ?? "__all__"}
          onValueChange={(v) =>
            setSeverity(v === "__all__" ? null : (v as RuntimeEventSeverity))
          }
        >
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue placeholder="全部级别" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部级别</SelectItem>
            {runtimeEventSeverities.map((s) => (
              <SelectItem key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Event list */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            暂无运行时事件
          </div>
        ) : (
          <div className="space-y-1 px-4 pb-4">
            {items.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}

            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="h-1" />

            {isLoadingMore && (
              <div className="flex items-center justify-center py-4">
                <Spinner className="size-4" />
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
