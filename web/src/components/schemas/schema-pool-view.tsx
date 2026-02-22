"use client";

import { JsonEditor } from "@/components/editors/json-editor";
import { KeyField } from "@/components/ui/key-field";
import type { SchemaRow } from "@/db/schema";
import type { PoolMeta } from "@/components/pool/types";
import { PoolRefBadge } from "@/components/pool/pool-ref-badge";

interface SchemaPoolViewProps {
  schema: SchemaRow;
  poolMeta: PoolMeta;
}

export function SchemaPoolView({ schema, poolMeta }: SchemaPoolViewProps) {
  return (
    <div className="space-y-3">
      <PoolRefBadge origin={poolMeta.origin} />
      <KeyField value={schema.key} />
      <div>
        <p className="text-xs font-medium text-muted-foreground">Name</p>
        <p className="mt-0.5 text-sm">{schema.name || "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Description</p>
        <p className="mt-0.5 text-sm whitespace-pre-wrap">{schema.description || "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Parameters</p>
        <div className="mt-1">
          <JsonEditor
            value={JSON.stringify(schema.parameters, null, 2)}
            height="400px"
            readOnly
          />
        </div>
      </div>
    </div>
  );
}
