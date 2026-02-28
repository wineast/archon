---
priority: P1
---
# 文件服务路由缺少授权检查可越权访问其他 Agent 文件

## Symptom（看到了什么）
`/api/agents/[id]/files/serve` 路由没有 `requireAgentRole` 授权检查，任何已认证用户通过知道/猜测 agentId 和文件名就能访问其他 Agent 的文件（Vercel Blob URL）。

## Trigger（怎么触发的）
已认证用户构造 `/api/agents/{其他agentId}/files/serve?name=xxx` 请求。

## Locale（大概在哪）
`web/src/app/api/agents/[id]/files/serve/route.ts`（1-29 行）

## Hypothesis（猜是什么原因）
路由入口缺少 `requireAgentRole(agentId, "viewer")` 检查，添加即可修复。
