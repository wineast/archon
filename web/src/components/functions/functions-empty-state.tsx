"use client";

import { FunctionSquareIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FunctionsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <FunctionSquareIcon className="size-12 opacity-30" />
      <p className="text-sm">Select or create a function</p>
      <Button variant="outline" size="sm" onClick={onCreate}>
        <PlusIcon className="mr-1.5 size-4" />
        New Function
      </Button>
    </div>
  );
}
