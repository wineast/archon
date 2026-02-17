"use client";

import { FlaskConicalIcon } from "lucide-react";

export function EvalEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <FlaskConicalIcon className="size-12 opacity-30" />
      <p className="text-sm">Select or create a case</p>
    </div>
  );
}
