# 客服聊天气泡（Support Bubble）

Build 页面右下角的客服聊天气泡，帮助用户了解和使用 Archon 的各项功能。

## 架构

- 客服助手本身是一个 Archon Agent（slug: `archon-support`），通过 embed 体系嵌入 build 页面
- 使用现有的 `widget.js` 嵌入脚本（dogfooding），不单独实现 UI
- API 按 slug 查询 agent + embed token，无需额外 schema 字段
- 该 Agent 标记为 `scope: "platform"`，普通用户的 Agent 列表 API 会过滤掉平台级 Agent，仅超级管理员可见

## 数据流

1. Agent 通过 Import API 导入 `fixtures/archon-support.json`（或在 UI 中手动创建）
2. Build 页面加载：`<SupportBubble>` 组件请求 `/api/platform/support-bubble`
3. API 按 slug `archon-support` 查 agent → 查其 embed token → 返回 `{ agentId, token }`
4. 组件动态注入 `<script src="/embed/widget.js" data-agent-id="..." data-token="...">`
5. widget.js 创建气泡按钮 + iframe，完全复用 embed 体系

## Seed 管线

Seed 管线仅播种全局数据（models、users）并为每个 user 创建 personal org + 3 个 slot agents（builder、assist、evaluator）。

Agent 数据（如 archon-support、gmcc-advisor）不再通过 seed 播种，而是通过 Export/Import 机制管理：
- 导出：`GET /api/agents/{id}/export` → JSON 快照
- 导入：`POST /api/agents/import` → 还原 Agent 及所有版本资源
- 种子 fixtures 保存在 `fixtures/` 目录（已 gitignore）

## 关键文件

| 文件 | 作用 |
|------|------|
| `fixtures/archon-support.json` | Agent 导出快照（用于 Import 还原） |
| `web/src/app/api/platform/support-bubble/route.ts` | 按 slug 查询客服配置的 API |
| `web/src/components/support-bubble/support-bubble.tsx` | 动态注入 widget.js 的包装组件 |
| `web/public/embed/widget.js` | 嵌入脚本（已有，复用） |
