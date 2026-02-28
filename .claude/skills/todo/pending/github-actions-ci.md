---
priority: P1
---
# 添加 GitHub Actions CI 工作流

项目完全没有 CI——PR 无自动化检查，靠 pre-push hook 和人工保障质量。至少需要 typecheck + lint + test 三个 job 在 PR 时自动运行。

> Anchor: 需新建 `.github/workflows/ci.yml`
