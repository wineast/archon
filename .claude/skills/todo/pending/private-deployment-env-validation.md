---
priority: P2
---
# 私有化部署环境变量校验和文档

关键 env var（API_KEY_ENCRYPTION_SECRET、CLERK_WEBHOOK_SECRET 等）缺失时运行时才报错，需要启动时校验脚本和 `.env.example` 文件。

> Anchor: `web/src/lib/crypto.ts:7-13`, `web/src/db/client.ts`
