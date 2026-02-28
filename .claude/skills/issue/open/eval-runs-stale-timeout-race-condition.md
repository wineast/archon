---
priority: P2
---
# evalRuns 超时处理存在读写竞态

## Symptom（看到了什么）
`api/eval/runs/route.ts` 的超时检测逻辑：先在内存中过滤 stale runs，再修改内存对象，最后批量 patch DB。读和写之间存在时间窗口，其他请求可能已改变 run 状态。

## Trigger（怎么触发的）
代码审查发现。虽然 WHERE 子句包含 `eq(evalRuns.status, "running")`，但内存中的 mutation（line 50）可能导致返回给用户的数据不一致。

## Locale（大概在哪）
`web/src/app/api/eval/runs/route.ts:26-53`

## Hypothesis（猜是什么原因）
原始实现为简化逻辑采用了先读后写模式。低并发时无影响，高并发时可能出现状态不一致。可以用 `RETURNING` 子句或事务解决。
