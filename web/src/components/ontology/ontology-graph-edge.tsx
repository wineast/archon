import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { OntologyEdge } from "./ontology-graph-layout";

const RELATION_ABBR: Record<string, string> = {
  has_one: "1:1",
  has_many: "1:N",
  belongs_to: "N:1",
  many_to_many: "N:N",
};

function OntologyGraphEdgeInner(props: EdgeProps<OntologyEdge>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const relation = data?.relation;

  return (
    <>
      <BaseEdge
        id={props.id}
        path={edgePath}
        className={cn(selected ? "!stroke-primary !stroke-2" : "!stroke-muted-foreground/40")}
      />
      {relation && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-auto nodrag nopan flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-[10px] shadow-sm cursor-pointer hover:border-primary"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <span className="font-medium">{relation.name}</span>
            <span className="text-muted-foreground">
              {RELATION_ABBR[relation.relationType] ?? relation.relationType}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const OntologyGraphEdge = memo(OntologyGraphEdgeInner);
