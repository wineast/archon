---
name: sync-upstream
description: 同步上游分支到当前工作区。当用户说"同步上游"、"sync 上游"、"拉取上游更新"、"同步上游分支"等时调用。
allowed-tools: Bash, Read, AskUserQuestion
---

将本地上游分支（主仓库的 base 分支）的最新变更 rebase 到当前工作区。

## 流程

### 1. 确认在工作区内

读取 `.worktree/meta.json`，获取 `baseBranch`。如果文件不存在，说明不在 worktree 中，提示用户。

```bash
cat .worktree/meta.json
```

### 2. 检查上游是否有未提交修改

上游工作区如果有未提交的变更，这些不会包含在本次同步中。

```bash
# 找到上游分支所在的 worktree 路径
git worktree list
# 检查上游是否干净
git -C <上游路径> status --short
```

如果上游有未提交修改，**立即停止**，告知用户上游有哪些未提交变更，**询问用户如何处理**（例如先去上游提交、忽略继续等）。**不要自动继续，等待用户明确指示。**

### 3. 检查当前工作区状态

```bash
git status --short
```

如果当前工作区有未提交变更，**立即停止**，告知用户当前工作区有未提交修改，**询问用户如何处理**（例如先提交、创建临时 commit 等）。**不要自动处理，等待用户明确指示。**

### 4. Rebase 上游分支

```bash
git rebase <baseBranch>
```

- 成功 → 继续下一步
- 冲突 → 进入冲突解决流程（见下方第 4.1 步）

### 4.1 冲突解决（仅在 rebase 冲突时）

1. **分析冲突**：读取所有冲突文件，理解冲突双方的意图
   ```bash
   git diff --name-only --diff-filter=U   # 列出冲突文件
   ```
2. **提出解决方案**：对每个冲突文件，向用户说明：
   - 冲突原因（上游改了什么，当前分支改了什么）
   - 建议的解决方案（保留哪边、如何合并）
3. **等待用户确认**：**必须等用户确认方案后才执行**，不要自动应用
4. **用户确认后执行解决**：按确认的方案修改冲突文件，然后继续 rebase
   ```bash
   git add <resolved-files>
   git rebase --continue
   ```
5. 如果后续 commit 继续冲突，重复 4.1 步骤

### 5. 依赖安装

Rebase 后检测 `package.json` / `package-lock.json` 是否有变更：

```bash
git diff HEAD~1 --name-only | grep -E "package(-lock)?\.json"
```

有变更则自动安装：

```bash
cd web && npm install
```

### 6. 验证

```bash
make typecheck
make test
```

## 注意

- "上游"是**本地 git 分支**（worktree 共享同一个仓库），不是远程分支，**不要执行 `git fetch`**
- baseBranch 从 `.worktree/meta.json` 读取，不要猜测或硬编码
- **任何异常情况都停下来询问用户**，不要自动决策
