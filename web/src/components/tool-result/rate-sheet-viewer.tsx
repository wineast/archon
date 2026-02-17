"use client";

/**
 * Rate Sheet 查看器
 *
 * 包含链接按钮、文档预览和侧边面板，
 * 定价和核保渲染器共用
 */

import { useState } from "react";
import { FileText } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ============================================================================
// 类型
// ============================================================================

export interface RateSheet {
  type: "pdf" | "pptx" | "image" | "html";
  url: string;
  title: string;
}

// ============================================================================
// Rate Sheet 链接按钮
// ============================================================================

export function RateSheetLinks({
  rateSheets,
  onSelect,
}: {
  rateSheets: RateSheet[];
  onSelect: (sheet: RateSheet) => void;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (rateSheets.length === 0) return null;

  if (rateSheets.length === 1) {
    const sheet = rateSheets[0];
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(sheet);
        }}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <FileText className="h-3 w-3" />
        <span className="truncate max-w-[200px]">{sheet.title}</span>
      </button>
    );
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <FileText className="h-3 w-3" />
          <span>Rate Sheets ({rateSheets.length})</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-1">
        <div className="flex flex-col">
          {rateSheets.map((sheet, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onSelect(sheet);
                setPopoverOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted rounded text-left"
            >
              <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{sheet.title}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// 文档预览
// ============================================================================

export function SourceDocumentViewer({ source }: { source: RateSheet }) {
  switch (source.type) {
    case "image":
    case "pptx":
      return (
        <div className="flex items-center justify-center bg-muted/30 rounded-lg p-4">
          <img
            src={source.url}
            alt={source.title || "Source document"}
            className="max-w-full h-auto rounded shadow-lg"
          />
        </div>
      );
    case "pdf":
      return (
        <iframe
          src={source.url}
          title={source.title || "PDF document"}
          className="w-full h-full rounded border"
        />
      );
    case "html":
      return (
        <iframe
          src={source.url}
          title={source.title || "HTML document"}
          className="w-full h-full rounded border bg-white"
        />
      );
    default:
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Unsupported document type
        </div>
      );
  }
}

// ============================================================================
// 侧边面板（Sheet 包装）
// ============================================================================

export function RateSheetPanel({
  selectedSheet,
  onClose,
}: {
  selectedSheet: RateSheet | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!selectedSheet} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[600px] sm:w-[800px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle className="text-sm font-mono truncate">
            {selectedSheet?.title}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 h-[calc(100vh-120px)] overflow-auto">
          {selectedSheet && <SourceDocumentViewer source={selectedSheet} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
