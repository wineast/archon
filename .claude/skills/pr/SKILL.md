---
name: pr
description: 创建 Pull Request 到 main。当用户说"创建 PR"、"提 PR"、"PR 到 main"、"合并到 main"、"提交并创建 PR"等时调用。
allowed-tools: Bash, Read, Grep, Glob, AskUserQuestion
---

将当前分支的变更创建 Pull Request 到 main 分支。

## 工作流

### 1. 确认当前状态

```bash
# 当前分支名
git branch --show-current

# 未提交的变更
git status -u

# 远程跟踪状态
git rev-parse --abbrev-ref @{upstream} 2>/dev/null || echo "no upstream"
```

- 如果当前分支就是 `main`，提示用户需要先切到功能分支
- 如果有未提交的变更，**询问用户**是否先提交

### 2. 同步远程 main（关键步骤）

本地 main 可能落后于远程，**不依赖本地 main**，直接用 `origin/main` 做对比：

```bash
git fetch origin main
```

### 3. 分析变更内容

对比当前分支与远程 main 之间的差异（即 PR 实际会包含的变更）：

```bash
# 当前分支相对于远程 main 的所有 commits
git log origin/main..HEAD --oneline

# 变更文件统计
git diff origin/main..HEAD --stat

# 详细 diff（用于理解改了什么，即 PR 的实际 diff）
git diff origin/main..HEAD
```

**必须用两点 `..`**（不是三点 `...`）——两点表示"从 origin/main 到 HEAD 的线性差异"，与 GitHub PR 页面展示的 diff 一致。分析所有 commits，理解本次 PR 的完整变更范围。

额外检查（用于决定 PR body 中包含哪些条件 section）：

```bash
# 是否包含数据库迁移文件或 schema 变更
git diff origin/main..HEAD --name-only | grep -E '(drizzle/|db/schema\.ts)'

# 是否包含 UI 变更（组件文件）
git diff origin/main..HEAD --name-only | grep -E '\.(tsx|css)$' | head -5
```

### 4. 推送当前分支

```bash
git push -u origin <当前分支名>
```

如果已有远程分支，普通 `git push` 即可。

### 5. 创建 PR

用 `gh pr create`，**base 分支始终为 `main`**：

摘要格式和各 section 规范遵循 `.claude/skills/_shared/merge-summary-format.md`。

```bash
gh pr create --base main --head <当前分支名> --title "<标题>" --body "$(cat <<'EOF'
<按 merge-summary-format.md 格式生成>
EOF
)"
```

#### PR 标题规范
- 70 字符以内
- 用 `feat:` / `fix:` / `refactor:` / `chore:` / `docs:` 前缀
- 中文或英文均可，与 commit 风格一致

### 6. 输出结果

返回 PR URL 给用户。

## 注意事项

- **永远 `git fetch origin main` 而非依赖本地 `main`**——本地 main 可能落后数十个 commit
- 如果 `gh pr create` 提示已有打开的 PR，用 `gh pr view` 查看现有 PR 并告知用户
- 不要自动 merge PR，只创建
- pre-push hook 可能会跑 typecheck + build，耐心等待
