---
priority: P1
---
# 积分扣减改为原子操作并添加余额下限约束

当前积分检查和扣减分两步执行且使用 60s 缓存，并发请求下存在 TOCTOU 超扣风险，需合并为原子 UPDATE 并添加 `CHECK >= 0` 约束。

> Anchor: `web/src/lib/usage/record.ts:71-76`、`web/src/lib/credits/queries.ts:17-31`
