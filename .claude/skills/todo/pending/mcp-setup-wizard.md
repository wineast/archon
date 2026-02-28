---
priority: P2
---
# MCP Server AI 辅助配置向导

当前 MCP Server 配置需要了解 OpenAPI spec、传输类型、headers 等技术细节，FDE 无法独立完成。需要：
1. AI 辅助配置："描述你的 API 端点" → Claude 建议 MCP 配置 → 预览工具列表后保存
2. OpenAPI 导入：上传 OpenAPI spec → 自动生成 MCP Server 配置
3. 常见 API 预设：Stripe、Salesforce、企微等常见集成的一键配置
4. 企业 API Key 保险柜：集中管理 API 密钥，按 MCP Server 授权

> Anchor: `web/src/components/mcp-servers/`, `web/guide/mcp-servers.md`
