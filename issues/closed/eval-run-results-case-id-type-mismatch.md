---
priority: P2
---
# evalRunResults.caseId 类型不一致（text vs uuid）

## Symptom（看到了什么）

`evalRunResults.caseId` 使用 `text("case_id")`，但其他 4 张测试结果表（schemaTestRunResults、functionTestRunResults、toolTestRunResults、componentTestRunResults）全部使用 `uuid("case_id")`。evalCases.id 本身是 uuid，类型应保持一致。

## Trigger（怎么触发的）

审查 schema 中各测试结果表的 caseId 字段类型时发现 evalRunResults 是唯一的异类。

## Locale（大概在哪）

- `web/src/db/schema.ts:684` — `caseId: text("case_id").notNull()`

## Hypothesis（猜是什么原因）

evalRunResults 表定义时可能早于其他测试结果表的统一规范化，使用了 text 类型。虽然没有 FK 约束（快照模式），但 text vs uuid 在比较、索引效率和类型安全上都有差异，与其他表不一致。

修复方向：将 `text("case_id")` 改为 `uuid("case_id")`，执行 `db-push`。
