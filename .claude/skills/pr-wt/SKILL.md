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
| `.worktree/REPORT.md` | PR 报告（合并判定、摘要、变更清单、验证结果） |
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

**保留终端输出**：将 typecheck 和 test 的关键输出保存，写入 Verification section 的代码块中（截取最后的摘要行，如 `Test Files X passed`、`Tests X passed`、`X error(s) found` 等），让 reviewer 直接看到原始结果。

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
6. **收集视频**：E2E 完成后扫描 `web/test-results/` 目录，将视频链接附到 Changes > UX 对应变更项下

```bash
# 收集视频文件路径
find web/test-results -name "video.webm" -not -path "*/.playwright-artifacts-*/*" | sort
```

视频链接格式：`[▶ <spec 描述>](/videos/<test-result-dir>/video.webm)`，紧跟在 Changes > UX 对应变更项后面
- `<test-result-dir>` 是相对于 `web/test-results/` 的路径
- `<spec 描述>` 从目录名提取（Playwright 用 describe+test 名命名目录）
- serve-report.mjs 的 `/videos/*` 路由会提供文件服务，页面自动将链接转为内联播放器
- **视频下方附带编号步骤描述**（从 spec 的 `test.step()` 提取），说明视频中每一步在做什么

如果无 spec 文件变更，跳过并在报告中标注"无 E2E 变更，跳过"。

### 6. 收集变更信息

```bash
git log <baseBranch>..HEAD --oneline
git diff <baseBranch>..HEAD --stat
git diff <baseBranch>..HEAD

# 条件 section 检测
git diff <baseBranch>..HEAD --name-only | grep -E '(drizzle/|db/schema\.ts)'
git diff <baseBranch>..HEAD --name-only | grep -E '\.(tsx|css)$' | head -5

# 是否包含 guide 文档变更
git diff <baseBranch>..HEAD --name-only | grep -E '^web/guide/' | head -5

# 是否包含导出格式迁移变更
git diff <baseBranch>..HEAD --name-only | grep -E '(versions/migrations/|versions/types\.ts|versions/snapshot\.ts)'

# 需求文档（如果存在）
cat .worktree/REQ.md 2>/dev/null
```

如果 `.worktree/REQ.md` 存在，读取需求文档内容，在生成 REPORT.md 时：
- Changes 每个变更项说明它满足了哪个需求点
- 帮助 reviewer 理解"为什么做这个变更"

### 7. 需求验收评估（条件执行）

仅当 `.worktree/REQ.md` 存在时执行。

使用 `Task` 工具**并行**创建至少 2 个独立评估 subagent（`subagent_type="general-purpose"`），每个 subagent 独立阅读完整的需求文档和实现代码，给出**整体评价**。

每个 subagent 的 prompt 包含：
- REQ.md 的完整内容（实现目标、为什么做、方案选择、预期变更、验收标准）
- `baseBranch..HEAD` 的完整 diff
- 工作区路径（用于读文件、grep 搜索代码证据）

subagent prompt 模板：

```
你是一个独立的需求评估者。请阅读完整的需求文档和代码变更，评估当前实现是否满足需求。

## 需求文档
<REQ.md 完整内容>

## 变更内容
<baseBranch..HEAD 的 diff>

## 评估要求
1. 阅读需求文档的实现目标、预期变更、验收标准
2. 阅读代码变更，必要时读取相关源文件、搜索测试用例
3. 给出整体评价：实现是否满足需求文档描述的目标
4. 指出亮点（做得好的地方）和不足（差距、遗漏、风险）
5. 最终给出二元判定：✅ 满足 / ❌ 不满足

## 输出格式
### 整体评价
<2-5 句话概述：实现与需求的匹配程度，核心功能是否到位>

### 亮点
- <做得好的点，引用具体代码/测试>

### 不足
- <差距或风险，引用具体证据；如果没有不足写"无">

### 判定
<✅ 满足 / ❌ 不满足> — <一句话理由>
```

收集所有 subagent 的返回结果，直接写入 Acceptance Reviews section（每个评估者一个子 section）。

**Verdict 判定时使用评估者共识**：
- 所有评估者判定 ✅ → 需求满足
- 有分歧 → ⚠️ 标注分歧，reviewer 需确认
- 所有评估者判定 ❌ → 需求未满足

### 8. 生成 REPORT.md

将所有信息写入 `.worktree/REPORT.md`：

```markdown
# PR Report: <工作区名称>

> <baseBranch> ← <当前分支>
> Generated: <时间>

## Verdict

<✅/⚠️/❌> **<可以合并/有条件合并/不建议合并>** — <一句话理由，综合质量检查、评估者共识、Breaking Changes>

判定规则：
- ✅ 可以合并：全部检查通过 + 评估者一致判定满足 + 无 breaking change
- ⚠️ 有条件合并：检查通过但评估者有分歧，或有 breaking change（说明注意事项）
- ❌ 不建议合并：任一检查失败，或评估者一致判定不满足（列出失败项）

如果有合并后注意事项（如 `make db-generate`），附在理由后面。

## Acceptance Reviews
<条件出现——仅当 `.worktree/REQ.md` 存在时>

每个评估者一个子 section，展示其独立的整体评价：

### Evaluator 1
#### 整体评价
<2-5 句话概述>
#### 亮点
- <引用具体代码/测试>
#### 不足
- <引用具体证据；无则写"无">
#### 判定
<✅ 满足 / ❌ 不满足> — <一句话理由>

### Evaluator 2
<同上格式>

**共识判定**：
- 所有评估者 ✅ → 需求满足
- 有分歧 → ⚠️ 标注分歧，reviewer 需确认
- 所有评估者 ❌ → 需求未满足

## Changes

按维度分类列出实际变更。每个变更项涉及 breaking change 的加 `⚠️ BREAKING` 标记。

### UX
<条件出现——有用户可感知的变化时>
- 每项用「原来 → 现在」对比格式，突出变化（用户视角）
- E2E 视频紧跟对应的变更项：[▶ spec 描述](/videos/<test-result-dir>/video.webm)
- 视频下方附带编号步骤描述（从 spec 的 `test.step()` 提取）

### DX
<条件出现——有开发者接口变化时>
- API 接口、配置项变化（开发者视角）

### Database
<条件出现——有 schema 变更时>

### Export Format
<条件出现——有导出格式迁移变更时>
- 写清版本号变化（如 v1 → v2）、迁移脚本名、关键逻辑
- 合并后确认迁移链完整

### Guide
<条件出现——有 guide 文档变更时>
- 按 CRUD 分类（新增/更新/删除），列出文件名 + 变更的章节

## Breaking Changes
<必写 section>
- 有 breaking change：按三维度说明（用户/FDE、技术/API、数据）
- 无 breaking change：写"无"并简要说明原因

## Verification

变更的自动化验证。每个变更项对应的测试决策：
- ✅ `test-file` — 说明验证了什么
- ✅ `test-file`（已有，更新）— 说明改了什么断言
- ⏭️ 无用例 — 说明原因（不可测 / 纯配置 / 已有覆盖等）

用例变更总览：

| | Count | Details |
|---|---|---|
| 新增 | +N | `new-test-1` `new-test-2` |
| 修改 | ~N | `updated-test-1` |
| 删除 | -N | — |

```
# typecheck
<make typecheck 的摘要输出，如：Found 0 error(s)>

# test
<make test 的摘要输出，如：Test Files  42 passed / Tests  1172 passed / Duration  12.34s>

# e2e（如果执行了）
<make e2e 的摘要输出，如：1 passed>
```

## Appendix
<git log --oneline>
<git diff --stat>
<涉及文件摘要>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### 9. 生成 merge.sh

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

# 合并后检测导出格式迁移变更
if git -C "$MAIN_REPO" diff HEAD~1 --name-only | grep -qE "(versions/migrations/|versions/types\.ts|versions/snapshot\.ts)"; then
    echo ""
    echo "⚠️  检测到导出格式迁移变更，请确认迁移链完整（模块加载时自动检测）"
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

### 10. 启动报告查看器

生成报告和脚本后，自动启动 Web 查看器并打开浏览器：

```bash
# 后台启动，不阻塞 Claude 会话
node .claude/skills/pr-wt/serve-report.mjs
# 用 Bash(run_in_background=true) 执行
```

向用户展示：

1. REPORT.md 的核心内容（Verdict + Summary）
2. 提示用户浏览器已打开报告页面，可在页面上查看完整报告、操作合并和删除工作区

## 注意

- **不自动执行合并**——只生成脚本，由用户决定何时执行
- **不自动删除工作区**——合并脚本执行后提示用户可选操作
- 合并脚本复用 `make wt-merge`，不重复实现合并逻辑
- `.worktree/` 目录已在 `.gitignore` 中，报告和脚本不会被提交
