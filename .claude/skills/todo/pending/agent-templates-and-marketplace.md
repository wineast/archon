---
priority: P1
---
# 实现 Agent 模板库 + 组件市场

FDE 目前必须从零构建每个 Agent，80% 的工作（工具、提示词、组件）跨行业重复。需要：
1. Agent 模板概念：Agent + 全部资源打包为可复用单元
2. 预置 5-10 个垂直模板（零售 FAQ、HR 聊天、CRM 助手等）
3. 模板浏览 UI + 一键实例化
4. 组件市场：发布/搜索/安装共享工具和组件（`origin: "marketplace"` 已预留但未实现）

竞品 Dify/Coze 都有模板市场，这是 FDE 效率的 10x 乘数。

> Anchor: `web/src/db/schema.ts`（RESOURCE_ORIGINS 已含 marketplace）, `web/guide/resource-pool.md`
