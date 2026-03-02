# Wiki 查询缺少 agentId 过滤导致跨 Agent 数据泄露

## Symptom（看到了什么）
`tool-context.ts` 中 `wiki.get(uuid)`、`wiki.search(query)`、`wiki.findByPrefix(prefix)` 三个方法查询 `wikiDocuments` 时没有 `agentId` 过滤条件，任何 Agent 的 Tool Handler 可以读取其他 Agent（甚至其他组织）的 Wiki 文档。

## Trigger（怎么触发的）
Tool Handler 中调用 `context.wiki.search("")` 可获取全库 wiki 文档，结合 `fetch()` 可将数据外泄到外部服务器。

## Locale（大概在哪）
`web/src/lib/tools/tool-context.ts` 第 165-179 行（get）、209-217 行（findByPrefix）、224-232 行（search）

## Hypothesis（猜是什么原因）
查询遗漏了 `agentId` 或 `versionId` 条件，需要在三个查询中加 `eq(wikiDocuments.versionId, versionId)` 过滤。
