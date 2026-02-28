---
priority: P3
---
# 规划 messages 表的大规模分区策略

messages 是增长最快的表。大规模时需考虑按时间（如按月）分区或归档策略，避免单表过大影响查询性能。

> Anchor: `web/src/db/schema.ts`（`messages` 表定义）
