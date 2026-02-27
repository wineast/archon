---
name: create-wt
description: 创建 git worktree 工作区。当用户说"创建工作区"、"新建工作区"、"开个工作区做XX"、"worktree create"等时调用。
allowed-tools: Bash, Read, Grep, Glob, Task, AskUserQuestion
---

创建 git worktree 工作区。仅负责创建工作区本身，不生成需求脚本。

## 参数

- `name`（必填）：worktree 名称，如 `fix-ontology-drag`
- `base`（可选）：基础分支，默认当前分支

如果用户传入完整路径如 `/path/to/.worktrees/hotfix`，提取最后的目录名 `hotfix` 作为 NAME。

## 流程

1. **创建 worktree**：
   ```bash
   make wt-create NAME=<name> BASE=<base>
   ```
2. **提示用户**：
   - worktree 路径：`.worktrees/<name>`
   - 进入方式：`cd .worktrees/<name> && claude`


## 核心原则：工作区必须独立并行

**每个工作区必须能独立开发、不依赖其他工作区的产出。** 这是最重要的设计约束。

### 创建时检查依赖

批量创建工作区前，必须分析功能之间的依赖关系：

1. **画依赖图**：梳理哪些功能依赖哪些前置功能
2. **合并有依赖的功能**：如果 B 依赖 A 的代码才能运行，则 A 和 B 必须放在同一个工作区
3. **只创建能独立启动的工作区**：每个工作区的所有前置依赖必须已经存在于 base 分支中
4. **延后创建**：如果某功能依赖其他工作区的产出，**不要现在创建**，等依赖合并回 base 分支后再建

### 示例

假设有 4 个功能：A（独立）、B（依赖 A）、C（依赖 A）、D（独立）

- **错误做法**：创建 4 个工作区 → B、C 工作区运行时发现缺 A 的代码
- **正确做法**：
  - 方案一：创建 3 个工作区 → `feature-abc`（合并 A+B+C）、`feature-d`
  - 方案二：创建 2 个工作区 → `feature-a`、`feature-d`，等 A 合并后再创建 B、C 的工作区

### 批量创建时的流程

用户要求一次创建多个工作区时：

1. 先分析所有功能的依赖关系
2. 向用户展示依赖图和分组方案
3. 确认后只创建能独立运行的工作区
4. 对延后的功能，告知用户何时可以创建

## 数据库管理

- **工作区内只用 `make db-push`**，不生成迁移文件——多个工作区并行开发时迁移生成顺序不固定，会产生冲突
- **合并回上游后统一生成迁移**：工作区合并到 dev/main 后，在上游分支执行 `make db-generate` 生成迁移文件并提交
- 工作区共享同一个 Docker PostgreSQL 容器，各自通过 `db-push` 同步 schema 到本地库即可
- 详见 `web/guide/production-database.md`
