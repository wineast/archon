# evalRunResults.caseId 类型不一致（text vs uuid）

## 问题描述

`evalRunResults.caseId` 使用 `text("case_id")`，但其他 4 张测试结果表（schemaTestRunResults、functionTestRunResults、toolTestRunResults、componentTestRunResults）全部使用 `uuid("case_id")`。evalCases.id 本身是 uuid，类型应保持一致。

## 涉及文件

- `web/src/db/schema.ts:684` — `caseId: text("case_id").notNull()`

## 分析

其他测试结果表的 caseId 统一用 uuid，evalRunResults 是唯一的异类。虽然没有 FK 约束（快照模式），但 text vs uuid 在比较、索引效率和类型安全上都有差异。

## 修复方向

将 `text("case_id")` 改为 `uuid("case_id")`，执行 `db-push`。
