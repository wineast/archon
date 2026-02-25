---
name: delete-wt
description: 删除 git worktree 工作区。当用户说"删除工作区"、"移除工作区"、"清理工作区"、"清空所有工作区"、"worktree clean"等时调用。
allowed-tools: Bash, Read
---

删除指定的 worktree 工作区，或清空所有工作区。

## 参数

- `name`（可选）：worktree 名称。不传则进入**清空模式**，删除所有工作区。

如果用户传入完整路径如 `/path/to/.worktrees/hotfix`，提取最后的目录名 `hotfix` 作为 NAME。

## 删除单个工作区

```bash
# 1. 先确认目标存在
make wt-list

# 2. 删除
make wt-delete NAME=<name>

# 3. 确认删除成功
make wt-list
```

## 清空所有工作区

当用户说"清空工作区"、"清理所有工作区"、"worktree clean"时执行。适用于 `.worktrees/` 目录中有残留的、失效的 worktree。

流程：
1. 先列出 `.worktrees/` 下所有目录
2. 对每个目录，先尝试 `make wt-delete NAME=<name>`
3. 如果 `wt-delete` 失败（git 记录已失效），直接 `rm -rf .worktrees/<name>`
4. 最后执行 `git worktree prune` 清理 git 中的失效记录
5. 确认清理结果：`make wt-list`

```bash
# 逐个尝试删除，失败则强制移除
for dir in .worktrees/*/; do
  name=$(basename "$dir")
  make wt-delete NAME="$name" || rm -rf ".worktrees/$name"
done

# 清理 git 中的失效 worktree 记录
git worktree prune

# 确认
make wt-list
```
