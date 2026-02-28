---
priority: P1
---
# 聊天网络重试与恢复机制

聊天消息发送和会话加载零重试逻辑。fetch 失败只显示 toast 后消失，FDE 在网络不稳定的现场部署环境中丢失对话上下文。需要：
1. 指数退避重试（消息发送、会话加载）
2. 离线状态检测 + 重连提示
3. "重试上一条消息"按钮
4. 会话恢复：刷新后自动恢复到最后位置

> Anchor: `web/src/components/chat-page-content.tsx:318-342`, `web/src/app/(nonlocale)/embed/[agentId]/page.tsx`
