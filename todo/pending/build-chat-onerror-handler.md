---
priority: P2
---
# 给 Build Chat 的 useChat 添加 onError 回调

Build Chat 的 `useChat()` 没有 `onError` 回调，AI 错误被静默吞没用户无任何反馈，主聊天页面有正确的 `onError` 处理可作为参考。

> Anchor: `web/src/components/build-chat/build-chat-panel.tsx:109`
