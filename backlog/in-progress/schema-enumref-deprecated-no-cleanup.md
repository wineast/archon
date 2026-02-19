# Schema enumRef 已废弃但仍在运行时生效，缺少清理路径

- **类型**: cleanup
- **优先级**: low
- **发现日期**: 2026-02-19
- **工作区**: schema-standardization

## 描述

`enumRef` 字段已被 `enumDatasetId` 替代，但：

1. `SchemaProperty` 类型仍包含 `enumRef?: string`
2. `schema-builder.ts` 仍有 enumRef 回退逻辑
3. 数据库中可能仍有使用 enumRef 的历史数据
4. 没有迁移脚本或清理计划

这意味着同一个 enum 参数可能同时有 `enumDatasetId` 和 `enumRef`，解析优先级不明确（当前是 enumDatasetId 优先）。

## 分析

`web/src/lib/schemas/types.ts:13` — 类型仍存在：

```typescript
enumRef?: string;
```

`web/src/lib/tools/schema-builder.ts:125-130` — 回退逻辑：

```typescript
// 2. enumRef → from resolvedVars (by key, backward compat)
if (param.enumRef && resolvedVars?.[param.enumRef] != null) {
  const val = resolvedVars[param.enumRef];
  const resolved = resolveEnumFromValue(val);
  if (resolved) return resolved;
}
```

## 修复方向

1. 确认线上是否还有使用 enumRef 的数据（查 DB 中 schemas.parameters 包含 enumRef 的记录）
2. 如果有，写迁移脚本把 enumRef 转为 enumDatasetId
3. 迁移完成后，从 SchemaProperty 类型和 schema-builder 中移除 enumRef
