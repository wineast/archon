---
priority: P1
---
# 积分扣减与用量记录非原子操作（计费漏洞）

## Symptom（看到了什么）
`record.ts` 中先 `insert usageRecords` 再 `update orgs.creditBalanceUSD`，两步不在同一事务内。如果第二步失败，用量已记录但积分未扣减——长期导致免费使用。

## Trigger（怎么触发的）
代码审查发现。数据库短暂不可用或连接池耗尽时第二步可能失败。

## Locale（大概在哪）
`web/src/lib/usage/record.ts:53-76`

## Hypothesis（猜是什么原因）
原始实现未用 `db.transaction()`。修复：将 insert + update 包在同一事务中。
