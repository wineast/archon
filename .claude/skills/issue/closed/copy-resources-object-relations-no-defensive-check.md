---
priority: P1
---
# copy-resources objectRelations 复制缺少防御性检查，版本复制可能崩溃

## Symptom（看到了什么）

版本复制时，objectRelations 的 `sourceTypeId` / `targetTypeId` 使用 `!` 非空断言从 `objTypeIdMap` 取值。如果引用的 objectType 被软删除但 relation 未同步软删除，map 中找不到对应 ID，`!` 会将 `undefined` 传给 insert，导致版本复制崩溃。

## Trigger（怎么触发的）

当 objectType 被软删除但其关联的 objectRelations 未同步软删除时，执行版本复制操作会触发此问题。

## Locale（大概在哪）

- `web/src/lib/versions/copy-resources.ts:196-197`

```typescript
sourceTypeId: objTypeIdMap.get(r.sourceTypeId)!,
targetTypeId: objTypeIdMap.get(r.targetTypeId)!,
```

## Hypothesis（猜是什么原因）

objectTypes 查询过滤了 `deletedAt IS NULL`，但 objectRelations 的 sourceTypeId/targetTypeId FK 指向的 type 可能已被软删除。DB 的 `onDelete: "cascade"` 只对硬删除生效，软删除不会级联。如果应用层软删除 type 时未同步软删除其 relations，版本复制就会炸。

修复方向（两种方案可同时做）：
1. **防御性过滤**：复制 relations 时 filter 掉 sourceTypeId/targetTypeId 不在 objTypeIdMap 中的行
2. **软删除级联**：在软删除 objectType 的应用代码中，同步软删除引用该 type 的 objectRelations
