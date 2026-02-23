"use client";

import { JsonEditor } from "@/components/editors/json-editor";
import { KeyDisplay } from "@/components/ui/key-display";
import type { DatasetRow } from "@/db/schema";
import type { PoolMeta } from "@/components/pool/types";
import { PoolRefBadge } from "@/components/pool/pool-ref-badge";

interface DatasetPoolViewProps {
  dataset: DatasetRow;
  poolMeta: PoolMeta;
}

export function DatasetPoolView({ dataset, poolMeta }: DatasetPoolViewProps) {
  return (
    <div className="space-y-3">
      <PoolRefBadge origin={poolMeta.origin} />
      <KeyDisplay value={dataset.key} />
      <div>
        <p className="text-xs font-medium text-muted-foreground">Name</p>
        <p className="mt-0.5 text-sm">{dataset.name || "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Description</p>
        <p className="mt-0.5 text-sm whitespace-pre-wrap">{dataset.description || "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Data</p>
        <div className="mt-1">
          <JsonEditor
            value={JSON.stringify(dataset.data, null, 2)}
            height="500px"
            readOnly
          />
        </div>
      </div>
    </div>
  );
}
