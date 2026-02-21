import type { ReactNode } from "react";
import { JsonEditor } from "@/components/editors/json-editor";

export interface DataCardProps {
  dataValue: string;
  onDataChange: (value: string) => void;
  headerExtra?: ReactNode;
  dataExtra?: ReactNode;
  height?: string;
}

export function DataCard({
  dataValue,
  onDataChange,
  headerExtra,
  dataExtra,
  height = "180px",
}: DataCardProps) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground">Data</label>
        {headerExtra}
      </div>

      {/* Data JSON */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Data (JSON)
        </label>
        <JsonEditor
          value={dataValue}
          onChange={onDataChange}
          height={height}
          className="mt-1"
        />
        {dataExtra}
      </div>
    </div>
  );
}
