# Vercel × Neon 数据库配置

## Neon 集成设置（Vercel Dashboard → Storage → archon → Configure）

| 选项 | 值 | 说明 |
|------|-----|------|
| Environments | Preview + Production | Development 已取消，本地用 Docker |
| Resource Required | Required | 部署前数据库必须 active |
| Create Database Branch | Preview 勾选，Production 不勾 | PR 自动创建子分支；生产直接用 main 分支，不额外建 |
| Custom Prefix | STORAGE | 环境变量前缀（`DATABASE_URL` 等） |

## 各环境数据库来源

| 环境 | 数据库 | 说明 |
|------|--------|------|
| Production | Neon main 分支 | Vercel 自动注入 `DATABASE_URL` |
| Preview | Neon 子分支（自动创建） | 每个 PR 独立数据库，合并后自动删除 |
| Development（本地） | Docker PostgreSQL | `make db-local-setup` 一键设置 |

## `vercel env pull` 拉取内容

取消 Development 后，pull 下来的 `.vercel/.env.development.local` 不再包含 `DATABASE_URL`，只有 Clerk 等其他变量。本地数据库连接由 `web/.env.development.local` 提供。

## 决策记录

### Production 不勾 "Create Database Branch"

勾选后每次生产部署会先 fork Neon 分支再跑迁移，失败可回滚——更安全。
但当前项目早期、团队小，额外分支占存储配额，回滚机制也不完全自动。
直接在 main 分支上迁移够用，等有真实用户数据时再开启。

### Development 取消 Neon 环境变量注入

之前 `vercel env pull` 拉到的是 Neon main 分支（生产库），本地开发直连生产有风险。
现在本地走 Docker PostgreSQL，不需要 Neon 给 Development 环境注入 `DATABASE_URL`。

## 变更记录

- 2026-02-18: 取消 Neon 的 Development 环境，本地开发改用 Docker PostgreSQL
