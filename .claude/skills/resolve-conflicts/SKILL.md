---
name: resolve-conflicts
description: 解决合并冲突。当用户说"解决冲突"、"resolve conflicts"、"合并冲突"、"冲突了"等时调用。
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Task
---

解决当前 worktree 中已存在的合并冲突。

## 前置条件

- 必须在 worktree 内执行（`.worktree/meta.json` 存在）
- 工作区必须处于冲突状态（由 `make wt-sync` 或手动 `git merge` 产生）
- 工作区不应有未提交变更（dirty 应在发起合并前处理）

## 流程

### 1. 确认冲突状态

```bash
cat .worktree/meta.json
git branch --show-current
git status
```

获取 `baseBranch`、当前分支名。确认工作区处于合并冲突状态（`git status` 显示 "You have unmerged paths"）。

如果没有冲突，提示用户当前无需解决冲突，终止。

### 2. 分析冲突文件

```bash
git diff --name-only --diff-filter=U
```

列出所有冲突文件。对每个冲突文件：

1. 读取文件内容，定位 `<<<<<<<` / `=======` / `>>>>>>>` 冲突标记
2. 分析冲突的两侧变更意图：
   - **ours（HEAD）**：当前工作区分支的改动——通常是新功能代码
   - **theirs（baseBranch）**：上游分支的改动——通常是其他工作区合并过来的
3. 根据语义理解决定保留策略：
   - 两侧改动不冲突（如不同行、不同函数）→ 保留双方
   - 两侧改动同一处但互补 → 合并两侧意图
   - 两侧改动矛盾 → 优先保留当前工作区（ours），因为这是本次开发的目标

### 3. 解决冲突

对每个冲突文件：

1. 使用 `Read` 读取完整文件
2. 使用 `Edit` 工具精确替换冲突区域，移除所有冲突标记
3. 确保替换后的代码语法正确、逻辑完整

所有冲突解决后：

```bash
git add -A
```

根据冲突来源选择提交方式：
- 如果是 `git merge` 产生的冲突（`git status` 显示 "All conflicts fixed but you are still merging"）：`git commit --no-edit`（使用自动生成的 merge commit message）
- 其他情况：`git commit -m "resolve: merge conflicts with <baseBranch>"`

### 4. 验证

```bash
make typecheck
make test
```

如果有失败，分析错误并修复（可能是合并引入的类型不匹配或测试断言变化），修复后重新提交。

### 5. 依赖安装

检测合并是否引入了依赖变更：

```bash
git diff HEAD~1 --name-only | grep -E "package(-lock)?\.json"
```

有变更则自动安装：

```bash
cd web && npm install
```

## 注意

- **禁止 `git stash`**——stash 跨 worktree 共享，会污染其他工作区
- **冲突解决策略偏向 ours**——当前工作区的代码是本次开发目标，上游变更是背景
- 解决完成后，报告查看器刷新即可看到状态更新
- 如果冲突过于复杂（涉及大规模重构），向用户说明情况，列出冲突文件和建议的解决方向，等待确认
