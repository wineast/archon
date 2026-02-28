---
priority: P1
---
# org_credit_transactions.created_by 缺 onDelete 策略，删除用户会报 FK 约束错误

## Symptom（看到了什么）

`org_credit_transactions.created_by` FK 引用 users 表，但未指定 `onDelete` 策略。Drizzle 默认为 no action，导致用户被删除时会因 FK 约束阻止删除。

## Trigger（怎么触发的）

当尝试删除一个已有交易记录的用户时，会因 FK 约束报错。

## Locale（大概在哪）

- `web/src/db/schema.ts:1708` — `created_by: uuid("created_by").references(() => users.id)` 缺 `{ onDelete: "set null" }`

## Hypothesis（猜是什么原因）

交易流水是财务数据，操作人被删后流水记录应保留，`created_by` 置 NULL 即可。当前缺少 onDelete 配置会导致：
1. 删除用户时如果该用户有交易记录会报 FK 约束错误
2. 或者代码层需要先清理 created_by 再删用户，增加复杂度

修复方向：

```ts
createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
```

修改后执行 `make db-push`。
