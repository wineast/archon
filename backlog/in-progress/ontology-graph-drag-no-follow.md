# 本体图谱拖拽节点不跟随鼠标

- **类型**: bug
- **优先级**: medium
- **发现日期**: 2026-02-19
- **工作区**: fix-ontology-drag

## 描述

Build 页面 > Ontology tab 中拖拽对象类型节点时，节点不跟随鼠标移动，松开鼠标后节点才瞬移到目标位置。期望的效果是拖拽时节点实时跟随鼠标。

## 分析

- `web/src/components/ontology/ontology-graph.tsx`
- ReactFlow 的 `nodes` 状态通过 `useState` 管理（第 54 行），但没有使用 `onNodesChange` 回调
- ReactFlow 需要 `onNodesChange` 来处理拖拽过程中的实时位置更新（position change 事件），否则节点位置在拖拽过程中不会更新到 React 状态
- 当前只有 `onNodeDragStop`（第 94-98 行）在拖拽结束时一次性更新位置，导致"瞬移"效果

## 修复方向

从 `@xyflow/react` 导入 `applyNodeChanges`，添加 `onNodesChange` 回调：

```tsx
import { applyNodeChanges, type NodeChange } from "@xyflow/react";

const onNodesChange = useCallback(
  (changes: NodeChange<OntologyNode>[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  },
  []
);

<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  ...
/>
```

添加后可以移除 `onNodeDragStop`（因为位置变更已经在 `onNodesChange` 中实时处理了）。
