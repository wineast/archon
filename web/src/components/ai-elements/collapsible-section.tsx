"use client";

import type { HTMLAttributes } from "react";
import { Children, isValidElement, memo } from "react";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type CollapsibleSummaryProps = HTMLAttributes<HTMLElement> & {
  node?: unknown;
};

export const CollapsibleSummary = memo(
  ({ node, className, children, ...props }: CollapsibleSummaryProps) => (
    <summary
      className={cn(
        "flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium text-sm select-none transition-colors hover:bg-muted/50",
        "[&::-webkit-details-marker]:hidden",
        className,
      )}
      {...props}
    >
      <ChevronRightIcon className="size-4 shrink-0 transition-transform duration-200 group-open/collapsible:rotate-90" />
      <span>{children}</span>
    </summary>
  ),
);

CollapsibleSummary.displayName = "CollapsibleSummary";

export type CollapsibleDetailsProps = HTMLAttributes<HTMLDetailsElement> & {
  node?: unknown;
};

export const CollapsibleDetails = memo(
  ({ node, className, children, ...props }: CollapsibleDetailsProps) => {
    const childArray = Children.toArray(children);
    const summaryIdx = childArray.findIndex(
      (child) => isValidElement(child) && child.type === CollapsibleSummary,
    );

    const summary = summaryIdx >= 0 ? childArray[summaryIdx] : null;
    const content = childArray
      .filter((_, i) => i !== summaryIdx)
      .filter((child) => !(typeof child === "string" && child.trim() === ""));

    return (
      <details
        className={cn(
          "group/collapsible my-4 overflow-hidden rounded-lg border border-border",
          className,
        )}
        {...props}
      >
        {summary}
        {content.length > 0 && (
          <div className="space-y-4 px-4 pb-3 pt-3 [&>*:first-child]:mt-0">
            {content}
          </div>
        )}
      </details>
    );
  },
);

CollapsibleDetails.displayName = "CollapsibleDetails";
