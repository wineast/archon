---
priority: P1
---
# 为 object_links 增加唯一约束防止重复关联

`(relation_id, source_id, target_id)` 无唯一约束，同一对实例可建多条相同关系的 link。需要加 `UNIQUE(relation_id, source_id, target_id)` 保证数据完整性。

> Anchor: `web/src/db/schema.ts` (object_links 表)
