---
priority: P2
---
# 补充 .env.example 和系统环境变量文档

项目缺少 `web/.env.example` 文件，新开发者不知道需要哪些环境变量。部分 env var（`CLERK_WEBHOOK_SECRET`、`CRON_SECRET`、`SECRET`）在代码中使用但无文档。`web/guide/env-vars.md` 文档只覆盖模板变量，不含系统 env。

> Anchor: `web/.env.development.local`, `web/guide/env-vars.md`
