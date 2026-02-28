---
priority: P2
---
# 引入速率限制中间件保护关键端点

AI 聊天、代码执行和认证端点无速率限制，Embed 端点面向公网可被滥用消耗 AI 额度，需按 IP/用户/组织多维度限流。

> Anchor: `web/src/middleware.ts`（Clerk middleware 处）
