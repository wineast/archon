---
priority: P0
status: merged
tags: [test, unit]
worktree: test-unit-chat-persistence
merged: true
---
# 单元测试：Chat 持久化层

`db/chat-persistence.ts`（8KB）是消息不丢失的保障，需覆盖 createSession、saveUserMessage、saveAssistantMessage、loadSessionMessages 和并发写入安全性。

> Anchor: `web/src/db/chat-persistence.ts`
