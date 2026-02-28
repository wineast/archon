---
priority: P2
---
# Agent 自动生成 REST API 端点

当前 Agent 只能通过聊天界面和 embed widget 访问，缺少 REST API 调用方式，企业集成需要 invoke API + API Key 认证 + SDK。

> Anchor: `web/src/app/api/chat/route.ts`（现有聊天 API），需新建 invoke API
