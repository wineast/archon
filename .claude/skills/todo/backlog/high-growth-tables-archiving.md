---
priority: P3
---
# 规划高增长表的归档策略

messages、usage_records、runtime_events 三张表增长最快，大规模时需规划按时间分区或 TTL 归档策略。

> Anchor: `web/src/db/schema.ts`（`messages` / `usageRecords` / `runtimeEvents` 表定义）
