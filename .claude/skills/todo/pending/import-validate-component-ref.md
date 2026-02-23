# 导入时校验工具 componentKey 需有对应 resourceRef

当前 `snapshot.ts` step 3b 直接查池组件（`agentId IS NULL`），未校验该池组件是否通过 `resourceRefs` 加入了 Agent 资源列表。应改为：只有 resourceRefs 中引用的池组件才能被工具的 componentKey 关联，否则 componentId 置 null。
