---
priority: P2
---
# 私有化部署环境变量校验和文档

私有化部署缺少启动时环境变量校验。关键 env var（API_KEY_ENCRYPTION_SECRET、CLERK_WEBHOOK_SECRET、CRON_SECRET 等）缺失时运行时才报错。需要：
1. 创建 `web/.env.example` 列出所有必需变量
2. 启动时校验脚本：缺失 env var 立即报错并提示
3. API_KEY_ENCRYPTION_SECRET 长度校验（最少 32 字节）
4. 加密密钥轮换机制

> Anchor: `web/src/lib/crypto.ts:7-13`, `web/src/db/client.ts`
