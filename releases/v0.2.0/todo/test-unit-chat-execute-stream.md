---
priority: P0
status: merged
tags: [test, unit]
worktree: test-unit-chat-execute-stream
merged: true
---
# 单元测试：Chat 流式执行核心逻辑

`chat/execute-stream.ts`（542 行）是产品核心，仅 1 个基础测试。需补充工具三源发现、Memory/RAG 注入、模板渲染、压缩触发、消息持久化时序、错误处理。

> Anchor: `web/src/lib/chat/__tests__/execute-stream.test.ts`
