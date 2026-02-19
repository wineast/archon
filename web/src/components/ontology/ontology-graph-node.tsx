import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { OntologyNodeData } from "./ontology-graph-layout";

function OntologyGraphNodeInner({ data }: NodeProps & { data: OntologyNodeData }) {
  const { objectType, isActive } = data;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-sm",
        isActive && "ring-2 ring-primary"
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !min-h-0 !bg-muted-foreground" />
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded text-[10px]"
        style={{ backgroundColor: objectType.color + "20", color: objectType.color }}
      >
        {objectType.icon.charAt(0).toUpperCase()}
      </span>
      <span className="max-w-[100px] truncate text-sm font-medium">{objectType.name}</span>
      <Handle type="source" position={Position.Right} className="!size-2 !min-h-0 !bg-muted-foreground" />
    </div>
  );
}

export const OntologyGraphNode = memo(OntologyGraphNodeInner);
