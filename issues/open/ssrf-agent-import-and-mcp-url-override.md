---
priority: P2
---
# Agent 导入和 MCP 服务器端点存在 SSRF 风险

## Symptom（看到了什么）
三个端点接受用户提供的 URL 并发起服务端请求，无域名验证：(1) `/api/agents/import` 接受 `blobUrl` 参数 (2) `/api/mcp-servers/[id]/test` 和 `/execute` 接受 `body.url` 覆盖存储的 URL。

## Trigger（怎么触发的）
用户传入 `http://169.254.169.254/latest/meta-data/` 等内网地址作为 URL，触发 SSRF 访问云元数据或内网服务。

## Locale（大概在哪）
`web/src/app/api/agents/import/route.ts`（49-59 行）、`web/src/app/api/mcp-servers/[id]/test/route.ts`（30-31 行）、`web/src/app/api/mcp-servers/[id]/execute/route.ts`（35-37 行）

## Hypothesis（猜是什么原因）
agent import 需要验证 `blobUrl` 只允许 Vercel Blob 域名；MCP test/execute 应移除或验证 `body.url` 参数，限定为已配置的 MCP 服务器地址。
