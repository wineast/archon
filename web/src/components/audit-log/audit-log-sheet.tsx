"use client";

import { useCallback, useEffect, useRef } from "react";
import { HistoryIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useAuditLogs } from "@/lib/audit/hooks";
import type { AuditLogResourceType } from "@/db/schema";
import { auditLogResourceTypes } from "@/db/schema";
import { useMembers } from "@/lib/members/hooks";
import {
  formatRelativeTime,
  formatAuditAction,
  RESOURCE_TYPE_LABELS,
} from "@/lib/audit/format";
import { useState } from "react";

interface AuditLogSheetProps {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditLogSheet({
  agentId,
  open,
  onOpenChange,
}: AuditLogSheetProps) {
  const [resourceType, setResourceType] =
    useState<AuditLogResourceType | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const { items, isLoading, isLoadingMore, hasMore, loadMore } = useAuditLogs({
    agentId: open ? agentId : undefined,
    resourceType,
    userId,
  });

  const { members } = useMembers(open ? agentId : undefined);

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
    if (!open) return;
    setupObserver();
    return () => observerRef.current?.disconnect();
  }, [open, setupObserver]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[400px] flex-col sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <HistoryIcon className="size-4" />
            操作日志
          </SheetTitle>
          <SheetDescription className="sr-only">
            Agent 配置变更的操作记录
          </SheetDescription>
        </SheetHeader>

        {/* Filters */}
        <div className="flex gap-2 px-4 pb-2">
          <Select
            value={resourceType ?? "__all__"}
            onValueChange={(v) =>
              setResourceType(v === "__all__" ? null : (v as AuditLogResourceType))
            }
          >
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue placeholder="全部资源" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部资源</SelectItem>
              {auditLogResourceTypes.map((rt) => (
                <SelectItem key={rt} value={rt}>
                  {RESOURCE_TYPE_LABELS[rt]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={userId ?? "__all__"}
            onValueChange={(v) => setUserId(v === "__all__" ? null : v)}
          >
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue placeholder="全部成员" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部成员</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.nickname ?? m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Timeline */}
        <ScrollArea className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="size-6" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              暂无操作记录
            </div>
          ) : (
            <div className="space-y-1 px-4 pb-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-accent/50"
                >
                  <Avatar className="size-7 shrink-0 mt-0.5">
                    <AvatarImage src={item.userAvatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {(item.userNickname ?? item.userEmail)?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">
                        {item.userNickname ?? item.userEmail ?? "未知用户"}
                      </span>{" "}
                      {formatAuditAction(
                        item.action,
                        item.resourceType,
                        item.resourceName
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                </div>
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
      </SheetContent>
    </Sheet>
  );
}
