---
priority: P0
status: merged
worktree: version-publish-missing-agent-ownership-check
merged: true
---
# 版本发布接口未校验 versionId 归属 agentId（跨 Agent 越权）

## Symptom（看到了什么）
`/api/agents/[id]/versions/[versionId]/publish` 只校验 version 是否存在，未校验 `version.agentId === agentId`。攻击者可构造请求将 Agent B 的版本发布到 Agent A 上。

## Trigger（怎么触发的）
代码审查发现。构造 `POST /api/agents/{agentA}/versions/{agentB-versionId}/publish` 即可复现。

## Locale（大概在哪）
`web/src/app/api/agents/[id]/versions/[versionId]/publish/route.ts:18-34`

## Hypothesis（猜是什么原因）
WHERE 子句只用了 `eq(agentVersions.id, versionId)`，漏掉了 `eq(agentVersions.agentId, agentId)` 条件。同样问题可能存在于版本删除接口。
