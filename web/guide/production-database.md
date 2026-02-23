# 数据库生产部署

## 迁移策略

### 开发阶段（worktree）

工作区中只用 `make db-push` 快速迭代 schema，不生成迁移文件。原因：多个工作区并行开发时，迁移文件的生成顺序不固定，容易产生冲突。

### 上游分支（dev/main）

工作区的 schema 变更合并回 dev/main 后，统一执行：

```bash
make db-generate   # 生成迁移 SQL 到 web/drizzle/
git add web/drizzle/
git commit -m "chore: generate migration for ..."
```

迁移文件必须提交到版本控制。

### 生产部署

生产环境只用 `make db-migrate`，禁止 `db-push`。

部署流程（Vercel 已自动化）：

```
vercel-build = npm run db:migrate && npm run db:seed && next build
```

`db:migrate` 内部流程：
1. 确保 pgvector 扩展存在（迁移前）
2. 执行 drizzle 迁移
3. 确保 HNSW 索引存在（迁移后）

`db:seed` 在迁移后自动执行，所有 seeder 使用 upsert 模式（`onConflictDoUpdate` / `onConflictDoNothing`），天然幂等，可安全重复运行。

## Neon 配置

### 环境变量

| 变量 | 用途 |
|------|------|
| `DATABASE_URL` | 连接池 URL（应用运行时） |
| `DATABASE_URL_UNPOOLED` | 直连 URL（迁移/schema push 使用） |

迁移和 drizzle-kit 优先使用 `DATABASE_URL_UNPOOLED`，避免连接池干扰 DDL 操作。

### 分支策略

Neon 支持数据库分支，可按需为 staging 环境创建分支：

- **main 分支**：生产数据
- **dev 分支**：开发/测试数据（可选）

## Seed 数据

### 幂等性

所有 seeder 使用 upsert 模式，每次部署自动运行，安全幂等：

- `seedModels`：`onConflictDoUpdate` on `modelId`
- `seedBuiltinPool`：`onConflictDoUpdate` / `onConflictDoNothing` on `key`
- `seedUsers`：`onConflictDoUpdate` on `clerkId`

Vercel 每次构建自动执行 `db:migrate → db:seed → next build`。

### 手动执行

```bash
make db-migrate   # 执行迁移
make db-seed      # 灌入种子数据
```

## 备份策略

### Neon 自带

- Point-in-Time Recovery (PITR)：支持恢复到任意时间点
- 自动快照：Neon Pro 计划每日自动备份

### 手动备份

重要变更前手动创建 Neon 分支作为快照：

```
neon branches create --name backup-YYYYMMDD
```

## 回滚

如果迁移出问题：

1. 检查 `web/drizzle/` 中最新的迁移文件
2. 手动编写反向 SQL 或使用 Neon PITR 回滚
3. Drizzle 不提供自动 rollback，需人工处理

## 命令速查

| 命令 | 用途 | 环境 |
|------|------|------|
| `make db-push` | 直推 schema（快速迭代） | 开发 |
| `make db-generate` | 生成迁移文件 | dev/main 分支 |
| `make db-migrate` | 执行迁移 | 生产 |
| `make db-reset` | 重置 + 重建 + seed | 开发 |
| `make db-seed` | 灌入种子数据 | 所有 |
