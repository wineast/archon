---
name: pr-wt
description: 工作区 PR。在工作区内发起，做检查、生成报告和合并脚本。当用户说"合并请求"、"MR"、"提交合并"、"合回上游"、"完成工作区"、"PR"（在工作区内）等时调用。
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Task, Skill
---

在工作区内部发起 PR：同步上游 → 质量检查 → review → 生成报告文件 + 合并脚本。

## 前置条件

必须在 worktree 内执行（`.worktree/meta.json` 存在）。

## 输出产物

在工作区根目录生成两个文件：

| 文件 | 用途 |
|------|------|
| `.worktree/REPORT.md` | PR 报告（摘要、变更清单、质量检查结果） |
| `.worktree/merge.sh` | 可执行合并脚本，用户跑 `bash .worktree/merge.sh` 即完成合并 |

## 流程

### 1. 读取工作区信息

```bash
cat .worktree/meta.json
git branch --show-current
basename "$(pwd)"
```

获取 `baseBranch`、当前分支名、工作区名称。如果 meta.json 不存在，提示用户不在 worktree 中，终止。

### 2. 自动提交未提交变更

```bash
git status --short
```

如果有未提交变更，**自动** `git add -A && git commit`（commit message 描述变更内容），不需要询问用户。

### 3. 同步上游

检查当前工作区是否落后于 baseBranch：

```bash
git rev-list HEAD..<baseBranch> --count
```

如果落后（count > 0），调用 `/sync-upstream` 技能同步上游变更。

### 4. 质量检查

依次执行：

```bash
make typecheck
make test
```

**记录结果**（通过/失败 + 摘要），不中断流程。失败时在报告中标记。

### 5. E2E 测试（条件执行）

检测本工作区是否包含 E2E 测试文件：

```bash
git diff <baseBranch>..HEAD --name-only | grep -E '\.spec\.ts$'
```

如果有新增或修改的 spec 文件：

1. 确保服务启动：`make up`
2. 后台执行 E2E：`Bash(run_in_background=true)` 运行 `make e2e`
3. 通过 `Read(output_file)` 定期查看日志判断进度
4. 卡住时用 `TaskStop` 终止并用 Playwright MCP 检查浏览器状态
5. 记录结果到报告

如果无 spec 文件变更，跳过并在报告中标注"无 E2E 变更，跳过"。

### 6. 收集变更信息

```bash
git log <baseBranch>..HEAD --oneline
git diff <baseBranch>..HEAD --stat
git diff <baseBranch>..HEAD

# 条件 section 检测
git diff <baseBranch>..HEAD --name-only | grep -E '(drizzle/|db/schema\.ts)'
git diff <baseBranch>..HEAD --name-only | grep -E '\.(tsx|css)$' | head -5
```

### 7. 生成 REPORT.md

将所有信息写入 `.worktree/REPORT.md`，格式遵循 `.claude/skills/_shared/merge-summary-format.md`，额外包含：

```markdown
# PR Report: <工作区名称>

> <baseBranch> ← <当前分支>
> Generated: <时间>

## Summary
<1-5 个要点>

## Changes
<git log --oneline 列表>
<git diff --stat>

## Database
<条件出现>

## Breaking changes
<必写 section>
- 有 breaking change：按三维度说明（用户/FDE、技术/API、数据）
- 无 breaking change：写"无"并简要说明原因

## Quality checks
| Check | Result |
|-------|--------|
| typecheck | ✅ passed / ❌ failed |
| test | ✅ X passed / ❌ X failed |
| e2e | ✅ passed / ⏭️ skipped / ❌ failed |

## How to merge
```bash
bash .worktree/merge.sh
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### 8. 生成 merge.sh

写入 `.worktree/merge.sh`，内容：

```bash
#!/bin/bash
# 自动生成的合并脚本 — <工作区名称> → <baseBranch>
# 生成时间: <时间>
set -e

MAIN_REPO="<主仓库绝对路径>"
WT_NAME="<工作区名称>"

echo "🔀 合并 $WT_NAME → <baseBranch>"
make -C "$MAIN_REPO" wt-merge NAME="$WT_NAME"

# 合并后检测 schema 变更
if git -C "$MAIN_REPO" diff HEAD~1 --name-only | grep -qE "(drizzle/|db/schema\.ts)"; then
    echo ""
    echo "⚠️  检测到 schema 变更，请执行: make db-generate"
fi

echo ""
echo "✅ 合并完成"
echo "下一步（可选）："
echo "  make wt-delete NAME=$WT_NAME    # 删除工作区"
```

主仓库路径通过以下命令获取：

```bash
git worktree list --porcelain | head -1 | sed 's/worktree //'
```

生成后设为可执行：

```bash
chmod +x .worktree/merge.sh
```

### 9. 启动报告查看器

生成报告和脚本后，自动启动 Web 查看器并打开浏览器：

```bash
# 后台启动，不阻塞 Claude 会话
node .claude/skills/pr-wt/serve-report.mjs
# 用 Bash(run_in_background=true) 执行
```

向用户展示：

1. REPORT.md 的核心内容（Summary + Quality checks）
2. 提示用户浏览器已打开报告页面，可在页面上操作合并和删除工作区

## 注意

- **不自动执行合并**——只生成脚本，由用户决定何时执行
- **不自动删除工作区**——合并脚本执行后提示用户可选操作
- 合并脚本复用 `make wt-merge`，不重复实现合并逻辑
- `.worktree/` 目录已在 `.gitignore` 中，报告和脚本不会被提交
