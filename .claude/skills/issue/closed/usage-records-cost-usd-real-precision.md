---
priority: P1
---
# usageRecords.costUSD 使用 real 存在精度问题

## Symptom（看到了什么）

`usageRecords.costUSD` 使用 `real("cost_usd")`（float4），与 `creditBalanceUSD` / `orgCreditTransactions.amount` / `balanceAfter` 同属财务字段，但未包含在现有 TODO（credit-balance-upgrade-to-numeric）中。用量费用在统计时会被聚合求和，浮点误差会累积。

## Trigger（怎么触发的）

审查 schema 中财务相关字段的精度时发现，已有 TODO 覆盖了 orgs.creditBalanceUSD 和 orgCreditTransactions 的 amount/balanceAfter，但遗漏了 usageRecords.costUSD。

## Locale（大概在哪）

- `web/src/db/schema.ts:1255` — `costUSD: real("cost_usd").notNull().default(0)`

## Hypothesis（猜是什么原因）

已有 TODO 覆盖了 orgs.creditBalanceUSD 和 orgCreditTransactions 的 amount/balanceAfter，但遗漏了 usageRecords.costUSD。三处应一并升级，否则 float4 的精度问题会在聚合求和时累积浮点误差。

修复方向：与 credit-balance-upgrade-to-numeric TODO 合并，一并将 `costUSD` 从 `real` 改为 `numeric` 或 `decimal`。
