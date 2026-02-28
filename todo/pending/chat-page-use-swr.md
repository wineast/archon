---
priority: P2
---
# chat-page-content 改用 SWR 加载会话和消息

`chat-page-content.tsx` 用原始 `fetch` + `Promise.all` 加载 sessions 和 messages，缺少重试、去重、自动刷新。应迁移到 SWR hooks，与其他页面保持一致。

> Anchor: `web/src/components/chat-page-content.tsx:320-323`
