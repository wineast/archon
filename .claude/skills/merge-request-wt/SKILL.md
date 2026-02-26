---
name: merge-request-wt
description: 工作区合并请求。在工作区内发起，做检查、展示摘要、确认后合并回上游。当用户说"合并请求"、"MR"、"提交合并"、"合回上游"、"完成工作区"等时调用。
allowed-tools: Bash, Read, Grep, Glob, AskUserQuestion
---

在工作区内部发起合并请求：检查代码质量 → 展示变更摘要 → 用户确认 → 执行合并回上游。

## 前置条件

必须在 worktree 内执行（`.worktree/meta.json` 存在）。

## 流程

### 1. 读取工作区信息

```bash
cat .worktree/meta.json
```

获取 `baseBranch`。如果文件不存在，提示用户不在 worktree 中，终止。

```bash
# 当前分支
git branch --show-current

# 工作区名称（从路径提取）
basename "$(pwd)"
```

### 2. 自动提交未提交变更

```bash
git status --short
```

如果有未提交变更，**自动** `git add -A && git commit`（commit message 描述变更内容），不需要询问用户。

### 3. 质量检查

依次执行，**任一失败则停止并报告**：

```bash
make typecheck
make test
```

如果失败，展示错误信息，让用户决定是修复还是跳过。

### 4. 端到端测试

检测本工作区是否包含 E2E 测试文件：

```bash
git diff <baseBranch>..HEAD --name-only | grep -E '\.spec\.ts$'
```

如果有新增或修改的 spec 文件，运行对应的 E2E 测试：

```bash
make e2e  # 或针对特定 spec: cd web && npx playwright test <spec-file>
```

- E2E 测试耗时较长，用 `Bash(run_in_background=true)` 后台执行
- 通过 `Read(output_file)` 定期查看日志判断进度
- 如果长时间无进展，用 `TaskStop` 终止并用 Playwright MCP 检查浏览器状态
- 测试通过 → 继续；失败 → 展示失败信息，让用户决定修复还是跳过

### 5. 变更摘要

对比当前分支与 base 分支的差异：

```bash
# 相对于 base 分支的所有 commits
git log <baseBranch>..HEAD --oneline

# 变更文件统计
git diff <baseBranch>..HEAD --stat

# 详细 diff（用于理解改了什么）
git diff <baseBranch>..HEAD
```

分析所有变更，向用户展示一份简洁的合并摘要：

- **工作区**：名称、分支
- **目标分支**：baseBranch
- **Commits**：列出所有 commit（单行）
- **变更概要**：用 1-5 个要点概括改了什么、为什么
- **文件统计**：N files changed, N insertions, N deletions
- **Schema 变更**：如果 diff 包含 `db/schema.ts`，提醒合并后需要 `make db-generate`
- **风险提示**：如有（如大量文件修改、破坏性变更等）

### 6. 用户确认

用 `AskUserQuestion` 让用户选择：

- **确认合并** — 执行合并
- **取消** — 终止，不做任何操作

### 7. 执行合并

确认后，在**主仓库**中执行已有的合并脚本：

```bash
# 找到主仓库路径
git worktree list --porcelain | head -1 | sed 's/worktree //'
```

```bash
# 在主仓库执行 make wt-merge（脚本自动处理 checkout、merge、依赖安装）
make -C <主仓库路径> wt-merge NAME=<工作区名称>
```

`wt-merge` 脚本已内置：切换到 baseBranch → merge 工作区分支 → 检测依赖变更自动 npm install。

如果合并冲突，脚本会报错退出，此时分析冲突内容，向用户说明解决方案。

### 8. 合并后处理

在主仓库中检测 schema 变更：

```bash
git -C <主仓库路径> diff HEAD~1 --name-only | grep -E "(drizzle/|db/schema\.ts)"
# 有变更则提醒用户执行 make db-generate
```

### 9. 输出结果

- 合并成功：告知用户已合并，提示可选的下一步操作（`make wt-delete NAME=<name>`、`make db-generate`）
- 合并失败：展示错误信息，给出解决建议

## 注意

- 本技能在**工作区内**执行，`merge-wt` 在**主仓库**执行——两者互补
- 合并操作需要切到主仓库目录执行，但前置检查在工作区内完成
- 不要自动删除工作区，让用户决定
