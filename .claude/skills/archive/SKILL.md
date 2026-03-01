---
name: archive
description: 发布归档。PR 合并到 main 后调用。将本次发布涉及的 merged 任务推进到终态（done/closed），打上 release 标签，清理集成/发布报告。当用户说"归档"、"archive"、"发布完成"、"PR 已合并"等时调用。
allowed-tools: Read, Glob, Grep, Bash, Edit
---

PR 合并后归档：推进任务终态 + 打 release 标签 + 清理报告文件。

## 核心理念

`/integrate` 扫描 `status: merged` 的任务，`/release` 基于集成报告做发布检查。PR 合并到 main 后，这些任务必须推进到终态，否则下次 `/integrate` 会重复扫描到它们。

归档 = 版本封存。每次归档用日期标记（如 `2026-03-02`），记录在任务 frontmatter 的 `release` 字段中。

## 执行流程

### 1. 确认 PR 已合并

检查 dev→main 的 PR 状态：

```bash
# 列出最近的 merged PR（dev→main）
gh pr list --base main --head dev --state merged --limit 1 --json number,mergedAt,title
```

如果没有找到 merged PR，提示用户确认 PR 是否已合并。

### 2. 读取集成报告

读取 `.worktree/INTEGRATE.md`，从 Scope 部分提取本次发布涉及的任务列表。

如果 `.worktree/INTEGRATE.md` 不存在，停止并告知用户缺少集成报告。

### 3. 推进任务状态

对每个涉及的 `status: merged` 任务：

- **todo 类型**：`merged` → `done`
- **issue 类型**：`merged` → `closed`

同时在 frontmatter 中添加 `release` 字段，值为当天日期（`YYYY-MM-DD`）。

修改方式：直接编辑任务文件的 frontmatter：
```yaml
# 修改前
---
priority: P0
status: merged
worktree: xxx
merged: true
---

# 修改后
---
priority: P0
status: done          # 或 closed（issue）
worktree: xxx
merged: true
release: 2026-03-02   # 本次发布日期
---
```

### 4. 清理报告文件

删除本次发布的集成/发布报告（为下次腾位）：

```bash
rm -f .worktree/INTEGRATE.md
rm -f .worktree/RELEASE_REPORT.md
rm -rf .worktree/RELEASE_REPORT.assets/
```

### 5. 同步远程

```bash
git add todo/ issues/
git commit -m "chore: archive release $(date +%Y-%m-%d)"
```

清理报告文件不需要提交（`.worktree/` 已 gitignore）。

### 6. 输出归档摘要

| 任务 | 类型 | 原状态 | 新状态 | Release |
|------|------|--------|--------|---------|
| xxx  | todo | merged | done   | 2026-03-02 |
| yyy  | issue | merged | closed | 2026-03-02 |

## 关键约束

- **仅操作本次发布涉及的任务**：从 INTEGRATE.md 的 Scope 提取任务列表，不是扫描所有 `merged` 任务
- **幂等**：已经是 `done`/`closed` 的任务跳过
- **不可逆**：归档后任务不会回到 `merged`，如需重新发布需要新建任务
- **release 标签**：使用日期格式 `YYYY-MM-DD`，同一天多次发布用同一个标签
