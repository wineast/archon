"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { BuiltinComponentDef } from "./builtin-components";

interface BuiltinComponentDetailProps {
  definition: BuiltinComponentDef;
}

export function BuiltinComponentDetail({
  definition,
}: BuiltinComponentDetailProps) {
  return (
    <ScrollArea className="h-full min-h-0">
      <div className="p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{definition.name}</h2>
          <p className="text-sm text-muted-foreground">
            {definition.description}
          </p>
        </div>

        {definition.examples.map((example) => (
          <div key={example.name} className="rounded-lg border">
            <div className="border-b px-4 py-2">
              <h3 className="text-sm font-medium">{example.name}</h3>
            </div>
            <div className="p-4">{example.render()}</div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
