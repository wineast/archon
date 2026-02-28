---
priority: P2
---
# 工具调用错误可视化 + 重试机制

工具执行失败时缺少清晰的 UI 反馈（无红框、错误图标、重试按钮），超时无进度指示，MCP 连接失败完全静默。

> Anchor: `web/src/components/message-parts.tsx:115-134`, `web/src/lib/chat/execute-stream.ts:152-205`
