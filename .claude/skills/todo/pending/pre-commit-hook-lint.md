---
priority: P2
---
# 添加 pre-commit hook 跑 lint

当前只有 pre-push hook（typecheck + build），没有 pre-commit。lint 问题要到 push 时才发现，反馈周期太长。添加轻量 pre-commit 只跑 lint（或 lint-staged），快速拦截格式和规则问题。

> Anchor: `.githooks/pre-push`（现有），需新建 `.githooks/pre-commit`
