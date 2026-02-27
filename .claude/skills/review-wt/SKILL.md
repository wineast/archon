---
name: review-wt
description: Review 工作区变更。当用户说"review"、"检查一下改了什么"、"看看完成了没"、"代码审查"等时调用。对比 baseBranch 与实际变更，输出 review 报告。
allowed-tools: Bash, Read, Grep, Glob, Task
---

对比工作区与 baseBranch 之间的所有变更，输出简洁的 review 报告。**只做分析，不做修改。**

## 前置条件

必须在 worktree 内执行（`.worktree/meta.json` 存在）。

## 流程

### 1. 收集变更

读取 `.worktree/meta.json` 获取 `baseBranch`，收集全部变更（未暂存 + 已暂存 + 已提交）：

```bash
# 未暂存 + 已暂存
git diff
git diff --cached

# 相对于 baseBranch 的提交
git log <baseBranch>..HEAD --oneline
git diff <baseBranch>..HEAD --stat
git diff <baseBranch>..HEAD
```

三类变更都为空则告知用户"无变更"并结束。

如果 diff 过大（超过 3000 行），用 `Task`（subagent_type=Explore）分文件阅读，避免遗漏。

### 2. 提取需求（可选）

如果工作区根目录有 `start.sh`，从中提取 prompt 作为需求基线，用于覆盖度分析。

没有 `start.sh` 则跳过需求覆盖度分析，只做变更审查。

### 3. 变更审查

分析所有 diff，关注：

- **变更概要**：每个文件一句话概括做了什么
- **关键逻辑**：核心代码变更（新 API、状态管理、UI 组件、hooks 等）
- **潜在问题**：只报告实际存在的问题（bug 风险、边界遗漏、并发问题等），不列举通过的检查项
- **约定违规**：仅当明确违反 CLAUDE.md 约定时才提（如 `Loader2Icon` 代替 `Spinner`、`watch()` 全量订阅等）

### 4. 需求覆盖度（仅当有 start.sh）

逐条对比需求中的功能点和验收标准：

- ✅ **已实现**：有明确的对应代码
- ⚠️ **部分实现**：说明缺失什么
- ❌ **未实现**：无对应代码

### 5. 收尾检查项

```
- [ ] 测试用例：是否有 __tests__/ 下的新增/修改
- [ ] 文档更新：web/guide/ 是否与代码变更一致
- [ ] typecheck：是否通过
- [ ] test：是否通过
- [ ] E2E：变更中有 .spec.ts 时是否通过
```

## 输出格式

```markdown
# Review 报告

## 变更概览
| 文件 | 类型 | 摘要 |
|------|------|------|

## 潜在问题
{问题列表，或"未发现问题"}

## 需求覆盖度（如有 start.sh）
- ✅ / ⚠️ / ❌ 逐条
**覆盖率**：X/Y（Z%）

## 收尾检查
- ✅ / ⚠️ / ❌ / ⏳ 逐条

## 总评
{一段话：完成度、风险、建议}
```

## 注意

- **只做分析，不做修改**
- **客观准确**：每个判断都要有 diff 依据，不猜测
- **关注遗漏而非风格**：重点是功能完整性和正确性
