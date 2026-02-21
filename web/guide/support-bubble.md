# 客服聊天气泡（Support Bubble）

Build 页面右下角的客服聊天气泡，帮助用户了解和使用 Archon 的各项功能。

## 架构

- 客服助手本身是一个 Archon Agent（slug: `archon-support`），通过 embed 体系嵌入 build 页面
- 使用现有的 `widget.js` 嵌入脚本（dogfooding），不单独实现 UI
- API 按 slug 查询 agent + embed token，无需额外 schema 字段
- 该 Agent 标记为 `isPlatform: true`（在 `agent.json` 中设置），普通用户的 Agent 列表 API 会过滤掉平台级 Agent，仅超级管理员可见

## 数据流

1. Seed 阶段：统一管线自动发现 `seed-data/archon-support/` 目录，创建 Agent + embed token
2. Build 页面加载：`<SupportBubble>` 组件请求 `/api/platform/support-bubble`
3. API 按 slug `archon-support` 查 agent → 查其 embed token → 返回 `{ agentId, token }`
4. 组件动态注入 `<script src="/embed/widget.js" data-agent-id="..." data-token="...">`
5. widget.js 创建气泡按钮 + iframe，完全复用 embed 体系

## Seed 管线

统一管线架构（`seed.ts`）：

1. **全局阶段**：`seedModels → seedPlatformSettings → seedUsers → seedOrgs`（运行一次）
2. **Agent 阶段**：自动扫描 `seed-data/` 下所有含 `agent.json` 的目录，根据文件存在性决定跑哪些 seeder

每个 agent 目录的文件决定了运行哪些 seeder：

| 文件/目录 | 对应 Seeder |
|-----------|-------------|
| `agent.json` | seedAgent（必须） |
| `components/` | seedComponents |
| `datasets.json` | seedDatasets |
| `tools.json` | seedTools |
| `wiki/` | seedWiki |
| `model-configs.json` | seedModelConfigs |
| `chat-config.json` | seedChatConfig |
| `functions/` | seedFunctions |
| `eval-cases.json` | seedEval |
| `memory.json` | seedMemory |
| `mcp-servers.json` | seedMcpServers |
| （无需文件） | seedEmbedToken、seedVersion |

## 关键文件

| 文件 | 作用 |
|------|------|
| `web/src/db/seed-data/archon-support/` | Agent seed 数据 |
| `web/src/db/seeders/seed-embed-token.ts` | 为每个 agent 创建默认 embed token |
| `web/src/app/api/platform/support-bubble/route.ts` | 按 slug 查询客服配置的 API |
| `web/src/components/support-bubble/support-bubble.tsx` | 动态注入 widget.js 的包装组件 |
| `web/public/embed/widget.js` | 嵌入脚本（已有，复用） |
