---
priority: P1
---
# Eval retry-failed 路由 DB 操作与 inngest.send 缺少事务保护

## Symptom（看到了什么）
retry-failed 路由先执行 DB 操作（删除旧结果 + 更新状态为 running），再调用 inngest.send。如果 send 失败，DB 已经被修改，状态被污染。

## Trigger（怎么触发的）
代码审查发现。测试文件中已有 TODO 注释标记此问题：`// TODO: Wrap in transaction or move inngest.send before DB mutations.`

## Locale（大概在哪）
`web/src/app/api/eval/run/[runId]/retry-failed/` 路由及其测试文件 `__tests__/retry-failed.test.ts:203`

## Hypothesis（猜是什么原因）
原始实现未考虑 inngest.send 失败场景。应该用事务包裹 DB 操作，或者将 inngest.send 移到 DB 操作之前（send 幂等，重发无害）。
