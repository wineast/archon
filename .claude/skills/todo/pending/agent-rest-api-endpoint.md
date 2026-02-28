---
priority: P2
---
# Agent 自动生成 REST API 端点

当前 Agent 只能通过聊天界面和 embed widget 访问，缺少 API 调用方式。企业需要：
1. Agent 发布后自动生成 REST API（POST /api/agents/{id}/invoke）
2. 支持流式和非流式两种调用模式
3. API Key 认证
4. SDK（Python/Node.js）方便企业集成
5. Webhook 回调（异步任务完成后通知）

42% 企业需要 8+ 数据源集成，API 是关键入口。

> Anchor: `web/src/app/api/chat/route.ts`（现有聊天 API），需新建 invoke API
