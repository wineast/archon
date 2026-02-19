# 本地 Docker PostgreSQL 开发指南

## 前提条件

- Docker Desktop（或 OrbStack 等兼容运行时）
- Node.js + npm

## 快速开始

### 首次 clone 项目

```bash
# 1. 先关联 Vercel（交互式，需手动执行）
cd web && npx vercel link && npx vercel pull
cd ..

# 2. 一键初始化
make setup
```

`make setup` 会检查 `web/.vercel` 是否存在，不存在则提示先执行上面的 vercel 命令。检查通过后依次执行：

```
vercel-check → db-up → wt-setup → wt-init
                        │                  │
                        │                  └── db-push + seed
                        │
                        ├── wt-meta
                        ├── link-env
                        ├── db-local-env
                        └── npm install
```

主仓库也被视为工作区——`wt-meta` 会创建 `.worktree/meta.json`（默认端口 3000），`db-local-env` 据此创建独立数据库 `archon_archon`。

完成后启动开发服务器：

```bash
make dev
```

## 环境切换

项目同时支持本地 Docker PostgreSQL 和 Neon 云数据库。利用 Next.js 环境变量优先级实现切换：

```
.env.development.local   ← 优先级最高（本地 DB URL）
.env.local               ← Vercel 符号链接（Neon + Clerk + ...），始终不动
```

### 切到本地 DB

```bash
make env
```

创建 `web/.env.local` symlink + `web/.env.development.local`（只含 2 行 DB URL），自动覆盖 `.env.local` 中的 Neon 地址。Clerk 等其他变量不受影响，继续从 `.env.local` 读取。在 worktree 中会自动创建独立数据库 `archon_<name>`。

### 切回 Neon 云 DB

```bash
make db-neon-env
```

删除 `web/.env.development.local`，`.env.local` 中的 Neon 地址恢复生效。

> 切换后需重启 `make dev`。

## Docker 容器管理

| 命令 | 作用 |
|------|------|
| `make db-up` | 启动 PostgreSQL 容器（后台运行，等待就绪） |
| `make db-down` | 停止容器（数据保留） |
| `make db-destroy` | 停止容器 **并删除数据卷**（数据清空） |

容器配置见 `docker-compose.yml`：

- 镜像：`postgres:17-alpine`
- 端口：`5432`
- 用户/密码/数据库：`archon` / `archon` / `archon`
- 数据持久化：Docker 命名卷 `pgdata`

## 数据库操作

| 命令 | 作用 |
|------|------|
| `make db-push` | 将 Drizzle schema 推送到数据库（开发用，不生成迁移文件） |
| `make db-push-force` | 强制推送 schema（会丢数据，用于破坏性变更） |
| `make seed` | 播种全部种子数据 |
| `make db-reset` | 清空所有表 → 重建 schema → 播种数据 |
| `make db-generate` | 生成 Drizzle 迁移文件 |
| `make db-migrate` | 执行迁移文件 |
| `make db-studio` | 启动 Drizzle Studio（数据库可视化） |

## 日常开发流程

### 典型一天

```bash
make db-up            # 启动 Docker PG（如果还没启动）
make dev              # 启动开发服务器
# ... 写代码 ...
make db-down          # 下班，停止容器（可选，数据不丢）
```

### 修改了 schema

```bash
# 编辑 web/src/db/schema.ts
make db-push          # 推送新 schema 到本地 DB
make seed             # 如果新增了表或字段，重新播种
```

### 想要干净的数据库

```bash
make db-destroy       # 删除容器和数据卷
make setup            # 重新一键设置
```

## 架构说明

### 驱动

使用 [`postgres`](https://github.com/porsager/postgres)（postgres.js）驱动，通过标准 PostgreSQL 线协议连接。它同时兼容：
- 本地 Docker PostgreSQL
- Neon 云数据库（生产环境）

ORM 层使用 `drizzle-orm/postgres-js`。

### 连接管理

- **Next.js 运行时**（`web/src/db/index.ts`）：通过 `globalThis` 单例复用连接，防止 HMR 热更新时连接泄漏。
- **CLI 脚本**（`web/src/db/client.ts`）：`createClient()` 工厂函数，自动加载 `.env.local`，优先使用 `DATABASE_URL_UNPOOLED`。脚本结束时调用 `sql.end()` 关闭连接。

### 环境变量

| 变量 | 用途 |
|------|------|
| `DATABASE_URL` | 主连接 URL（Next.js 运行时使用） |
| `DATABASE_URL_UNPOOLED` | 直连 URL（CLI 脚本、Drizzle Kit 优先使用） |

本地开发时两者相同，主仓库指向 `postgresql://archon:archon@localhost:5432/archon_archon`，worktree 指向 `archon_<name>`。

生产环境中 `DATABASE_URL` 可能指向连接池（如 Neon 的 pooler），`DATABASE_URL_UNPOOLED` 指向直连地址。

## 故障排查

### 端口 5432 被占用

```bash
lsof -i :5432  # 查看谁占了端口
```

### 容器启动失败

```bash
docker compose logs postgres  # 查看日志
```

### 连接被拒绝

确认覆盖文件存在：

```bash
cat web/.env.development.local
```

应该看到 `localhost:5432`。如果文件不存在，运行 `make env`。
