---
priority: P2
---
# 测试运行相关表缺少索引和 soft-delete

schema/function/tool/component 的 test_runs 和 test_cases 表：
1. FK 列（schemaId/functionId/toolId/componentId）无索引，按资源查询无法利用索引
2. 无 deletedAt 字段（硬删除，无法审计和恢复）
3. 无 updatedAt 字段（无法追踪修改）
4. test_cases 缺少 versionId，跨版本测试数据混入

> Anchor: `web/src/db/schema.ts`（search: schemaTestRuns, functionTestRuns, toolTestRuns, componentTestRuns）
