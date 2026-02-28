---
priority: P1
---
# 将金额字段从 real 升级为 numeric 避免浮点精度问题

`orgs.credit_balance_usd`、`org_credit_transactions.amount`、`org_credit_transactions.balance_after` 三个字段当前使用 `real`(float4)，有浮点精度风险。进入真实支付场景前必须升级为 `numeric`/`decimal`。

> Anchor: `web/src/db/schema.ts`
