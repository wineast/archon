---
priority: P2
---
# 工具调用错误可视化 + 重试机制

工具执行失败时缺少清晰的 UI 反馈：
1. 错误无视觉区分（红框、错误图标、重试按钮都没有）
2. 超时无进度指示（30s 等待像卡死）
3. 错误文本被截断到 500 字，关键调试信息丢失
4. MCP Server 连接失败完全静默，用户不知道整个能力缺失
5. 需要"重试上一步"按钮，不必重发整条消息

> Anchor: `web/src/components/message-parts.tsx:115-134`, `web/src/lib/chat/execute-stream.ts:152-205`
