---
priority: P2
---
# 聊天界面移动端适配

聊天界面缺少响应式断点：
1. 会话历史侧边栏（w-96）在移动端不折叠，占 25% 屏宽
2. 输入区域固定 padding，不适配小屏
3. Embed 模式不适应竖屏/横屏切换
4. FDE 现场部署常用 iPad/手机预览 Agent 效果，移动端体验差影响交付

> Anchor: `web/src/components/chat-page-content.tsx`, `web/src/app/(nonlocale)/embed/[agentId]/page.tsx`
