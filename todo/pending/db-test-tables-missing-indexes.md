---
priority: P2
---
# 测试运行相关表缺少索引和 soft-delete

test_runs / test_cases 表的 FK 列无索引、无 deletedAt/updatedAt 字段、test_cases 缺少 versionId 导致跨版本数据混入。

> Anchor: `web/src/db/schema.ts`（search: schemaTestRuns, functionTestRuns, toolTestRuns, componentTestRuns）
