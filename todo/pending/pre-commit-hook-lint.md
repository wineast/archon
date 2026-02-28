---
priority: P2
---
# 添加 pre-commit hook 跑 lint

当前只有 pre-push hook，lint 问题要到 push 时才发现，添加轻量 pre-commit 只跑 lint-staged 快速拦截。

> Anchor: `.githooks/pre-push`（现有），需新建 `.githooks/pre-commit`
