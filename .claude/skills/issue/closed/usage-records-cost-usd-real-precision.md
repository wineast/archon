# usageRecords.costUSD 使用 real 存在精度问题

## 问题描述

`usageRecords.costUSD` 使用 `real("cost_usd")`（float4），与 `creditBalanceUSD` / `orgCreditTransactions.amount` / `balanceAfter` 同属财务字段，但未包含在现有 TODO（credit-balance-upgrade-to-numeric）中。用量费用在统计时会被聚合求和，浮点误差会累积。

## 涉及文件

- `web/src/db/schema.ts:1255` — `costUSD: real("cost_usd").notNull().default(0)`

## 分析

已有 TODO 覆盖了 orgs.creditBalanceUSD 和 orgCreditTransactions 的 amount/balanceAfter，但遗漏了 usageRecords.costUSD。三处应一并升级。

## 修复方向

与 credit-balance-upgrade-to-numeric TODO 合并，一并将 `costUSD` 从 `real` 改为 `numeric` 或 `decimal`。
