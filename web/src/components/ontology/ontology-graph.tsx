"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  useReactFlow,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ObjectTypeRow, ObjectRelationRow } from "@/db/schema";
import { OntologyGraphNode } from "./ontology-graph-node";
import { OntologyGraphEdge } from "./ontology-graph-edge";
import {
  buildGraphElements,
  applyDagreLayout,
  type OntologyNode,
  type OntologyEdge,
} from "./ontology-graph-layout";

const nodeTypes = { objectType: OntologyGraphNode };
const edgeTypes = { relation: OntologyGraphEdge };
const EMPTY_DELETE_KEYS: string[] = [];

interface OntologyGraphInnerProps {
  objectTypes: ObjectTypeRow[];
  objectRelations: ObjectRelationRow[];
  activeTypeId: string | null;
  onSelectType: (id: string) => void;
  onSelectRelation?: (relationId: string) => void;
}

function OntologyGraphInner({
  objectTypes,
  objectRelations,
  activeTypeId,
  onSelectType,
  onSelectRelation,
}: OntologyGraphInnerProps) {
  const { fitView } = useReactFlow();

  const { layoutNodes, layoutEdges } = useMemo(() => {
    const { nodes, edges } = buildGraphElements(
      objectTypes,
      objectRelations,
      activeTypeId
    );
    const result = applyDagreLayout(nodes, edges);
    return { layoutNodes: result.nodes, layoutEdges: result.edges };
  }, [objectTypes, objectRelations, activeTypeId]);

  const [nodes, setNodes] = useState<OntologyNode[]>(layoutNodes);
  const [edges, setEdges] = useState<OntologyEdge[]>(layoutEdges);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges]);

  useEffect(() => {
    // Wait a tick for ReactFlow to measure nodes before fitting
    const t = setTimeout(() => fitView({ padding: 0.2 }), 50);
    return () => clearTimeout(t);
  }, [layoutNodes, layoutEdges, fitView]);

  const onNodeClick: NodeMouseHandler<OntologyNode> = useCallback(
    (_event, node) => {
      onSelectType(node.id);
    },
    [onSelectType]
  );

  const onEdgeClick: EdgeMouseHandler<OntologyEdge> = useCallback(
    (_event, edge) => {
      if (onSelectRelation) {
        onSelectRelation(edge.id);
      }
      // Select the source type so user can see the relation in detail panel
      onSelectType(edge.source);
    },
    [onSelectType, onSelectRelation]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      onNodeDragStop={(_event, node) => {
        setNodes((prev) =>
          prev.map((n) => (n.id === node.id ? { ...n, position: node.position } : n))
        );
      }}
      fitView
      panOnScroll
      zoomOnDoubleClick={false}
      deleteKeyCode={EMPTY_DELETE_KEYS}
      proOptions={{ hideAttribution: true }}
    >
      <Background bgColor="var(--sidebar)" />
    </ReactFlow>
  );
}

export interface OntologyGraphProps {
  objectTypes: ObjectTypeRow[];
  objectRelations: ObjectRelationRow[];
  activeTypeId: string | null;
  onSelectType: (id: string) => void;
  onSelectRelation?: (relationId: string) => void;
}

export function OntologyGraph(props: OntologyGraphProps) {
  return (
    <ReactFlowProvider>
      <OntologyGraphInner {...props} />
    </ReactFlowProvider>
  );
}
