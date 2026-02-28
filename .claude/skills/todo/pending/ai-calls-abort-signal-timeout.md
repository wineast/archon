---
priority: P2
---
# 给所有 AI 调用添加 abortSignal 超时控制

所有 `streamText()` 和 `generateText()` 调用缺少 `abortSignal` 超时控制，Provider 挂起时连接会阻塞至平台 kill 且无优雅错误提示。

> Anchor: `web/src/lib/chat/execute-stream.ts`、`web/src/lib/build-chat/execute-stream.ts`
