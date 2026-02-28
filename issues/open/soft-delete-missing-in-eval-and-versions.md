---
priority: P1
---
# 部分查询缺少 soft-delete 过滤（evalRuns、agentVersions）

## Symptom（看到了什么）
代码扫描发现以下路由查询资源时未过滤 `deletedAt`，可能返回已软删除的数据：
- `web/src/app/api/eval/runs/route.ts` — evalRuns 查询无 deletedAt 过滤
- `web/src/app/api/agents/[id]/versions/route.ts` — agentVersions 列表无 deletedAt 过滤
- `web/src/app/api/pool/[resourceType]/route.ts` — 用 JS `.filter()` 后过滤而非 SQL WHERE

## Trigger（怎么触发的）
代码扫描。对比其他正确实现（如 `api/tools/[id]/route.ts:19` 使用 `isNull(table.deletedAt)`）发现不一致。

## Locale（大概在哪）
上述三个 API 路由文件。

## Hypothesis（猜是什么原因）
这些路由编写时间较早或由不同开发者编写，未遵循后来建立的 soft-delete 查询规范。pool 路由的后过滤还有性能问题——先查全量再 JS 过滤。
