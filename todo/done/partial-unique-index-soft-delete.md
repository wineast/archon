---
priority: P1
---
# 将软删除表的唯一约束改为 partial unique index

所有有 `deletedAt` 的表的唯一约束需改为 `WHERE deleted_at IS NULL`，避免软删除记录阻止创建同 key 的新记录。

> Anchor: `web/src/db/schema.ts`
