---
name: sync-upstream
description: 同步上游分支到当前工作区。当用户说"同步上游"、"sync 上游"、"拉取上游更新"、"同步上游分支"等时调用。
allowed-tools: Bash, Read, AskUserQuestion
---

将本地上游分支（主仓库的 base 分支）的最新变更合并到当前工作区。

## 流程

### 1. 确认在工作区内

读取 `.worktree/meta.json`，获取 `baseBranch`。如果文件不存在，说明不在 worktree 中，提示用户。

```bash
cat .worktree/meta.json
```

### 2. 检查上游是否有未提交修改

上游工作区如果有未提交的变更，这些不会包含在本次同步中。提醒用户先去上游提交。

```bash
# 找到上游分支所在的 worktree 路径
git worktree list
# 检查上游是否干净
git -C <上游路径> status --short
```

如果上游有未提交修改，**询问用户**是否继续。

### 3. 暂存当前变更

> **禁止使用 `git stash`**——stash 是跨 worktree 共享的，会污染其他工作区。

```bash
git status --short
# 如果有未提交变更，创建临时 commit
git add -A && git commit -m "wip: temp commit before sync"   # 仅在有变更时执行
```

### 4. 合并上游分支

```bash
git merge <baseBranch>
```

- 成功 → 继续下一步
- 冲突 → 分析冲突内容，向用户说明解决方案，等待确认后执行解决

### 5. 恢复暂存

```bash
# 仅在第 3 步创建了临时 commit 时：撤销临时 commit，保留变更在工作区
git reset HEAD~1
```

### 6. 依赖安装

合并后检测 `package.json` / `package-lock.json` 是否有变更：

```bash
git diff HEAD~1 --name-only | grep -E "package(-lock)?\.json"
```

有变更则自动安装：

```bash
cd web && npm install
```

### 7. 验证

```bash
make typecheck
make test
```

## 注意

- "上游"是**本地 git 分支**（worktree 共享同一个仓库），不是远程分支，**不要执行 `git fetch`**
- baseBranch 从 `.worktree/meta.json` 读取，不要猜测或硬编码
