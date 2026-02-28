---
priority: P1
---
# 聊天网络重试与恢复机制

聊天消息发送和会话加载零重试逻辑，fetch 失败只显示 toast 后消失，FDE 在网络不稳定的现场部署环境中会丢失对话上下文。

> Anchor: `web/src/components/chat-page-content.tsx:318-342`、`web/src/app/(nonlocale)/embed/[agentId]/page.tsx`
