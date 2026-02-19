import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { ObjectTypeRow, ObjectRelationRow } from "@/db/schema";

/* ------------------------------------------------------------------ */
/*  Data types                                                         */
/* ------------------------------------------------------------------ */

export type OntologyNodeData = {
  objectType: ObjectTypeRow;
  isActive: boolean;
};

export type OntologyEdgeData = {
  relation: ObjectRelationRow;
};

export type OntologyNode = Node<OntologyNodeData, "objectType">;
export type OntologyEdge = Edge<OntologyEdgeData>;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const NODE_WIDTH = 160;
const NODE_HEIGHT = 40;

/* ------------------------------------------------------------------ */
/*  Build nodes & edges from data                                      */
/* ------------------------------------------------------------------ */

export function buildGraphElements(
  objectTypes: ObjectTypeRow[],
  objectRelations: ObjectRelationRow[],
  activeTypeId: string | null
): { nodes: OntologyNode[]; edges: OntologyEdge[] } {
  const nodes: OntologyNode[] = objectTypes.map((ot) => ({
    id: ot.id,
    type: "objectType",
    position: { x: 0, y: 0 },
    data: { objectType: ot, isActive: ot.id === activeTypeId },
  }));

  const edges: OntologyEdge[] = objectRelations.map((rel) => ({
    id: rel.id,
    type: "relation",
    source: rel.sourceTypeId,
    target: rel.targetTypeId,
    data: { relation: rel },
  }));

  return { nodes, edges };
}

/* ------------------------------------------------------------------ */
/*  Apply dagre auto-layout                                            */
/* ------------------------------------------------------------------ */

export function applyDagreLayout(
  nodes: OntologyNode[],
  edges: OntologyEdge[]
): { nodes: OntologyNode[]; edges: OntologyEdge[] } {
  if (nodes.length === 0) return { nodes, edges };

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 120 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutNodes, edges };
}
