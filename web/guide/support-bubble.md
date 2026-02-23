# 客服聊天气泡（Support Bubble）

Build 页面右下角的客服聊天气泡，帮助用户了解和使用 Archon 的各项功能。

## 架构

- 客服助手是 org 级 `support` 槽位绑定的 Agent，通过 embed 体系嵌入 build 页面
- 使用现有的 `widget.js` 嵌入脚本（dogfooding），不单独实现 UI
- API 通过 orgSlots 查找 support agent + embed token，无需硬编码 slug

## 数据流

1. 管理员通过导入 fixture 创建 support agent + embed token，手动配置 orgSlot 绑定
2. Build 页面加载：`<SupportBubble orgId={agent.orgId}>` 请求 `/api/orgs/{orgId}/support-bubble`
3. API 查 `orgSlots(orgId, "support")` → 获取 agentId → 查 embed token → 返回 `{ agentId, token }`
4. 组件动态注入 `<script src="/embed/widget.js" data-agent-id="..." data-token="...">`
5. widget.js 创建气泡按钮 + iframe，完全复用 embed 体系

## 关键文件

| 文件 | 作用 |
|------|------|
| `web/src/lib/slots/constants.ts` | support 槽位定义（SLOT_DEFS） |
| `web/src/app/api/orgs/[id]/support-bubble/route.ts` | 按 org 查询客服配置的 API |
| `web/src/components/support-bubble/support-bubble.tsx` | 动态注入 widget.js 的包装组件 |
| `web/public/embed/widget.js` | 嵌入脚本（已有，复用） |
