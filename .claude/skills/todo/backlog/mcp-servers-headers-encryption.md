---
priority: P2
---
# 加密 mcp_servers.headers 中的敏感凭证

headers jsonb 可能包含 API Key / Bearer Token，当前明文存储。建议与 org_api_keys 同等加密处理，防止数据库泄露时暴露凭证。

> Anchor: `web/src/db/schema.ts`（`mcpServers` 表 `headers` 字段）
