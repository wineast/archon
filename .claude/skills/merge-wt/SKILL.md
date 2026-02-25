---
name: merge-wt
description: 合并 git worktree 工作区回上游分支。当用户说"合并工作区"、"merge 工作区"、"合并到上游"、"工作区合回去"等时调用。
allowed-tools: Bash, Write, Edit, Read, Grep, Glob, Task
---

将工作区分支合并回其 base 分支（记录在 `.worktree/meta.json` 中）。

## 参数

- `name`（必填）：worktree 名称

如果用户传入完整路径如 `/path/to/.worktrees/hotfix`，提取最后的目录名 `hotfix` 作为 NAME。

## 流程

1. **路径检查**：确认当前工作目录是主仓库（不在 `.worktrees/` 内）。如果当前在 worktree 内，**先 cd 回主仓库**再执行合并命令。
2. **自动提交未提交变更**：工作区有未提交修改时，自动 `git add -A && git commit` 提交（不需要询问用户），commit message 描述工作区的改动内容。
3. **执行合并**：
   ```bash
   make wt-merge NAME=<name>
   ```
4. **冲突处理**：如果合并有冲突，分析冲突内容，解决后提交合并。
5. **验证**：合并完成后运行 typecheck 和测试，确保合并没有引入问题：
   ```bash
   make typecheck
   make test
   ```
6. **依赖检测**：合并后自动检测 `package.json` / `package-lock.json` 是否有变更，有则自动执行 `make deps`

## 数据库管理

- 合并回上游后，如果 schema 有变更，统一执行 `make db-generate` 生成迁移文件并提交
- 详见 `web/guide/production-database.md`
