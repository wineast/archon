---
priority: P2
---
# 为 API 路由添加 Zod 运行时请求体验证

当前绝大部分 API 路由直接 `req.json()` 解构无运行时类型安全，畸形请求可能导致意外行为或不明确的错误。

> Anchor: `web/src/app/api/pool/[resourceType]/route.ts`
