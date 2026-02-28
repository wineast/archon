# Git Worktree 工作区

通过 git worktree 实现多任务并行开发，每个工作区拥有独立的分支、端口、数据库和 Claude Code 会话。

---

## 命令速查

### 初始化

| 命令 | 说明 | 场景 |
|------|------|------|
| `make setup` | vercel-check → db-up → wt-setup → wt-init | clone 后执行一次 |
| `make teardown` | wt-fini → wt-teardown → 停 Docker 并删除数据卷 | 重置到初始状态 |
| `make db-init` | db-push + seed | 重新推 schema + 灌数据 |

### 工作区

| 命令 | 说明 |
|------|------|
| `make wt-list` | 列出所有工作区 |
| `make wt-create NAME=<name>` | 创建工作区（基于当前分支，自动 `db-init`） |
| `make wt-create NAME=<name> BASE=main` | 创建工作区（基于指定分支） |
| `make wt-sync` | 同步上游分支到当前工作区（在工作区内执行） |
| `make wt-merge NAME=<name>` | 合并工作区回 base 分支（在主仓库执行） |
| `make wt-delete NAME=<name>` | 删除工作区（自动删除独立数据库） |

---

## 初始化流程

### 首次 clone

```bash
cd web && npx vercel link && npx vercel pull && cd ..
make setup
```

`make setup` 执行：

1. **vercel-check** — 确保 `web/.vercel` 存在
2. **db-up** — 启动 Docker PostgreSQL
3. **wt-setup**（`scripts/wt-setup.mjs`）— 静态环境初始化：
   - wt-meta — 创建 `.worktree/meta.json`（主仓库端口 3000）
   - link-env — 创建 `.env.local` symlink
   - db-local-env — 生成 `.env.development.local`（指向独立数据库）
   - npm install
4. **wt-init**（`scripts/wt-init.mjs`）— 数据初始化：
   - db-push + seed

### 创建工作区

`make wt-create NAME=<name>` 执行：

1. **git worktree add** — 基于 base 分支创建新分支 `<base>-<name>-<日期>`，目录 `.worktrees/<name>`
2. **复制 Vercel 配置** — 将 `web/.vercel` 拷贝到工作区
3. **wt-setup** — 通过环境变量传随机端口，创建 `meta.json` + link-env + createdb + npm install
4. **wt-init** — db-push + seed
5. **生成 `CLAUDE.local.md`** — 工作区路径和端口
6. **执行 `init.sh`** — 如果主仓库 `.worktree/` 下存在
7. **链接 Claude Code 自动记忆** — 共享主项目记忆

```json
// .worktree/meta.json
{
  "dev": 5183,
  "storybook": 5184,
  "studio": 5185,
  "baseBranch": "dev"
}
```

每个工作区（包括主仓库）拥有独立数据库，完全隔离。

---

## 同步上游

在工作区内执行 `make wt-sync`，将 base 分支的最新变更合并过来：

1. 检查上游工作区是否有未提交修改，有则提醒
2. 当前工作区有未提交变更时，自动 stash → merge → stash pop
3. 合并后检测 `package.json` / `package-lock.json` 变更，有则自动 `npm install`

注意：这里的"上游"是本地 git 分支（worktree 共享同一个 git 仓库），不会执行 `git fetch`。

---

## 合并回 base

在主仓库执行 `make wt-merge NAME=<name>`：

1. 检查工作区是否有未提交更改
2. 切换到 base 分支
3. 执行 `git merge`
4. 合并后检测依赖变更，有则自动 `npm install`

---

## 删除工作区

`make wt-delete NAME=<name>` 执行以下清理：

1. 检查是否有未提交更改，有则确认
2. 执行 `.worktree/cleanup.sh`（如果存在）
3. 终止端口服务
4. **wt-fini** — 删除对应的本地数据库 `archon_<name>`
5. **wt-teardown** — 删缓存/依赖 + 环境文件 + `.worktree/`
6. `git worktree remove` 删除工作区

---

## 通过 Claude Code 技能使用

除了直接使用 make 命令，也可以在 Claude Code 中通过 `/worktree` 技能操作，技能会额外处理：

- **创建时**：基于 guide/ 文档变更分析需求 → 调研代码 → 生成 `start.sh` 启动脚本
- **`start.sh`**：进入工作区后执行，自动启动 Claude Code 并注入任务描述

```bash
cd .worktrees/<name> && ./start.sh
```

---

## 目录结构

```
archon/
├── .worktree/
│   └── meta.json          # 主仓库元数据（端口、baseBranch）
├── .worktrees/
│   ├── feature-a/
│   │   ├── .worktree/
│   │   │   └── meta.json  # 工作区元数据
│   │   ├── CLAUDE.local.md # Claude Code 本地配置
│   │   ├── start.sh       # 启动脚本
│   │   └── web/            # 项目代码
│   └── feature-b/
│       └── ...
```
