---
priority: P2
status: pending
worktree:
---
# 修正 tool_error 误判，error 值为 undefined/空字符串时不再标记为错误

工作区 fix-error-undefined 已有修复提交（5b5e246），但未合并回 dev。error 字段为 undefined 或空字符串时被错误标记为工具调用失败。

> Anchor: 工作区 fix-error-undefined 的提交 `5b5e246`
