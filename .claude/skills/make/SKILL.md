---
name: make
description: Makefile 命令速查与执行指南。当用户询问"怎么跑"、"有哪些命令"、"make 怎么用"，或要求执行任何 make 相关命令时调用。
allowed-tools: Bash, Read
---

Makefile 命令速查与使用指南。项目所有操作统一通过 `make` 执行，不要直接 `cd web && npm ...`。

## 命令速查

### 初始化 & 清理

| 命令 | 说明 |
|------|------|
| `make setup` | 项目初始化（clone 后执行一次）：检查 Vercel 配置 → 启动 Docker PG → worktree 环境初始化 |
| `make teardown` | 反向清理：worktree 清理 → 停止 Docker 并删除数据卷 |

### 开发服务

| 命令 | 说明 |
|------|------|
| `make up` | 启动所有服务（db + dev + storybook + studio），日志在 `.logs/` |
| `make down` | 停止所有服务 |
| `make restart` | 重启所有服务 |
| `make dev` | 仅启动 Next.js dev server |
| `make storybook` | 仅启动 Storybook |
| `make restart-dev` | 重启 dev server |
| `make restart-storybook` | 重启 storybook |
| `make restart-studio` | 重启 drizzle studio |

### 构建 & 检查

| 命令 | 说明 |
|------|------|
| `make build` | 构建 Next.js 项目 |
| `make lint` | 运行 ESLint |
| `make typecheck` | TypeScript 类型检查（`tsc --noEmit`） |
| `make test` | 运行 Vitest 测试 |
| `make clean` | 清除 `.next` 和 `node_modules` |

### 数据库

| 命令 | 说明 | 何时使用 |
|------|------|----------|
| `make db-up` | 启动 Docker PostgreSQL | 本地开发前 |
| `make db-down` | 停止 PostgreSQL 容器 | 不需要数据库时 |
| `make db-destroy` | 停止并删除数据卷 | 彻底清理本地数据 |
| `make db-init` | `db-push` + `db-seed` | 首次建库或重建后 |
| `make db-push` | 推送 schema 到数据库（Drizzle push） | schema 变更后（非破坏性） |
| `make db-push-force` | 强制推送 schema（跳过确认） | 已知安全的 schema 变更 |
| `make db-reset` | 删除所有表 → 推送 schema → 灌种子数据 | schema 有破坏性变更、或 `db-push` 需要交互确认时 |
| `make db-seed` | 仅灌种子数据 | 需要重新填充测试数据 |
| `make db-studio` | 启动 Drizzle Studio（可视化数据库） | 查看/编辑数据 |
| `make db-generate` | 生成迁移文件 | **当前阶段不用**，直接 `db-push` |
| `make db-migrate` | 执行迁移 | **当前阶段不用** |
| `make db-neon-env` | 切换回 Neon 云 DB | 从本地 DB 切回云 DB |

### Git Worktree

| 命令 | 说明 |
|------|------|
| `make wt-list` | 列出所有 worktree |
| `make wt-create NAME=xxx [BASE=main]` | 创建 worktree |
| `make wt-sync` | 同步上游分支到当前工作区 |
| `make wt-merge NAME=xxx` | 合并工作区回 base 分支 |
| `make wt-delete NAME=xxx` | 删除 worktree |
| `make wt-setup` | worktree 静态环境初始化 |
| `make wt-teardown` | worktree 静态环境清理 |
| `make wt-init` | worktree 数据初始化（db-push + seed） |
| `make wt-fini` | worktree 数据清理 |

### Fixtures

| 命令 | 说明 |
|------|------|
| `make fixture-zip NAME=xxx` | 将 `data/fixtures/<name>/` 文件夹打包为 ZIP，用于导入 |

## 常用操作流程

### 日常开发

```bash
make db-up          # 启动数据库
make dev            # 启动 dev server
```

### Schema 变更后

```bash
# 非破坏性变更（新增列等）
make db-push

# 破坏性变更（删列、改类型等）——db-push 会要求交互确认，直接用 db-reset
make db-reset
```

### 代码修改收尾

```bash
make typecheck      # 类型检查
make test           # 跑测试
```

### 首次 clone 项目

```bash
make setup          # 一键初始化
make up             # 启动所有服务
```

## 注意事项

- 所有命令在项目根目录执行，不需要 `cd web`
- worktree 内的端口号从 `.worktree/meta.json` 读取，避免端口冲突
- `make up` 的日志输出到 `.logs/` 目录（`dev.log`、`storybook.log`、`studio.log`）
- Docker PostgreSQL 容器无响应时，先 `docker rm -f archon-postgres` 再 `make db-up`
