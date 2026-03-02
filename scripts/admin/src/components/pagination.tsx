"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  onPrev,
  onNext,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 border-t py-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
        <ChevronLeftIcon />
        <span>上一页</span>
      </Button>
      <span className="min-w-[120px] text-center text-xs text-muted-foreground">
        {page} / {totalPages} ({totalItems} 条)
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={onNext}
      >
        <span>下一页</span>
        <ChevronRightIcon />
      </Button>
    </div>
  );
}
