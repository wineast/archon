---
name: worktree
description: 管理 git worktree（创建、列出、删除、合并工作区）。当用户说"创建工作区"、"合并到 main"、"merge 到 main"等类似表述时，应调用此技能。
allowed-tools: Bash, Write, AskUserQuestion
---

管理 git worktree 工作区。

## 触发条件

当用户提到以下任意表述时，应调用此技能（`/worktree`）：
- "创建工作区"、"帮我创建工作区"、"新建工作区"
- "列出工作区"、"查看工作区"
- "删除工作区"
- "合并到 main"、"合并回 main"

## 调用方式

```
/worktree                    # 列出所有 worktree
/worktree create <name>      # 创建 worktree（基于当前分支）
/worktree create <name> main # 创建 worktree（基于指定分支）
/worktree delete <name>      # 删除 worktree
/worktree merge <name>       # 合并指定 worktree 到 main
/worktree clean              # 清空所有 worktree（强制清理）
```

## 操作流程

### 列出 worktree（无参数或 `list`）

```bash
make wt-list
```

### 创建 worktree（`create`）

参数：
- `name`（必填）：worktree 名称，如 `feature-auth`
- `base`（可选）：基础分支，默认当前分支

```bash
make wt-create NAME=<name> BASE=<base>
```

创建后提示用户：
- worktree 路径：`.worktrees/<name>`
- 如何进入：`cd .worktrees/<name>`

### 删除 worktree（`delete`）

```bash
# 1. 先确认目标存在
make wt-list

# 2. 删除
make wt-delete NAME=<name>

# 3. 确认删除成功
make wt-list
```

### 合并 worktree 到 main（`merge`）

将指定工作区的分支合并回 main。从 main 目录执行。

```bash
make wt-merge NAME=<name>
```

### 清空所有 worktree（`clean`）

当 `.worktrees/` 目录中有残留的、失效的 worktree 时（如 `git worktree remove` 报错），使用 `clean` 强制清理。

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

## 注意事项

- 只需传入 worktree 名称，不需要完整路径
- 如果用户传入完整路径如 `/path/to/.worktrees/hotfix`，提取最后的目录名 `hotfix` 作为 NAME
- 如果用户没有指定子命令，默认执行 `list`
