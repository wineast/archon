# Git Worktree 工作区

通过 git worktree 实现多任务并行开发，每个工作区拥有独立的分支、端口、数据库和 Claude Code 会话。

---

## 命令速查

### 数据库

| 命令 | 说明 | 执行频率 |
|------|------|----------|
| `make db-setup` | 启动 Docker + 主库初始化（push + seed） | 全局一次 |
| `make db-init` | push schema + seed（数据库已存在） | 每个工作区 |

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

## 创建流程

`make wt-create NAME=<name>` 执行以下初始化步骤：

### 1. 创建 git worktree

基于 base 分支创建新分支 `<base>-<name>-<日期>`，工作目录位于 `.worktrees/<name>`。

### 2. 复制 Vercel 配置

将主仓库 `web/.vercel` 拷贝到工作区，并创建软链接 `web/.env.local → .vercel/.env.development.local`。

### 3. 创建独立本地数据库

如果 Docker 容器 `archon-postgres` 正在运行，自动：
- 在容器内 `createdb` 创建独立数据库 `archon_<name>`
- 写入独立的 `.env.development.local` 指向该数据库
- 执行 `make db-init`（push schema + seed 数据）

每个工作区数据完全隔离，互不影响。

### 4. 生成 `.worktree/meta.json`

随机分配端口，记录 base 分支信息：

```json
{
  "dev": 5183,
  "storybook": 5184,
  "studio": 5185,
  "baseBranch": "dev"
}
```

### 5. 生成 `CLAUDE.local.md`

从模板渲染，告诉 Claude Code 当前工作区路径和端口：

| 服务 | 说明 |
|------|------|
| Dev Server | `make dev` |
| Storybook | `make storybook` |
| Drizzle Studio | `make db-studio` |

### 6. 执行初始化脚本

如果主仓库 `.worktree/` 下存在 `init.sh`，会复制到工作区并执行。

### 7. 链接 Claude Code 自动记忆

工作区共享主项目的 Claude Code auto memory，确保跨工作区的记忆一致。

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
3. 删除对应的本地数据库 `archon_<name>`（如果存在）
4. `git worktree remove` 删除工作区

---

## 通过 Claude Code 技能使用

除了直接使用 make 命令，也可以在 Claude Code 中通过 `/worktree` 技能操作，技能会额外处理：

- **创建时**：采访式澄清需求 → 生成 `start.sh` 启动脚本 → 同步功能树
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
