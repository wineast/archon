# Build Chat — 对话式 Agent 配置助手

Build 页面左侧的聊天窗，让 FDA/编辑者通过对话操作 Agent 的所有资源。

## 架构

### Server Tool 方案

聊天窗中的 AI 通过 Vercel AI SDK 的 server-side tools 直接操作数据库（Drizzle ORM），不走 REST API。

- 入口统一校验 `editor+` 权限，工具内不需要重复校验
- 工具定义集中在后端
- 前端通过 SWR `mutate()` 刷新即可同步

### SWR 同步机制

每个 server tool 的返回值中包含 `_mutateKeys` 字段，前端在 `onToolCall` 中提取这些 key 并调用 `globalMutate()` 刷新对应面板。

已有的 SWR key 映射：

| 资源 | SWR Key 函数 | 格式 |
|------|-------------|------|
| Tools | `toolsApiKey` | `/api/tools?agentId={id}` |
| Schemas | `schemasApiKey` | `/api/schemas?agentId={id}` |
| Wiki | `wikiApiKey` | `/api/wiki?agentId={id}` |
| Datasets | `datasetsApiKey` | `/api/datasets?agentId={id}` |
| Functions | `functionsApiKey` | `/api/functions?agentId={id}` |
| Components | `componentsApiKey` | `/api/components?agentId={id}` |
| Model Configs | `modelConfigsApiKey` | `/api/model-configs?agentId={id}` |
| Chat Config | `chatConfigApiKey` | `/api/chat-configs?agentId={id}` |
| Object Types | `objectTypesApiKey` | `/api/object-types?agentId={id}` |
| Object Relations | `objectRelationsApiKey` | `/api/object-relations?agentId={id}` |

### 监控

Build Chat 同样拥有完整的三项监控：

- **用量记录**：`recordUsage({ source: "build-chat" })`
- **运行时事件**：`recordRuntimeEvents()` 记录 `llm_call` 事件
- **会话持久化**：前端生成 `sessionId`，首次消息创建 `chatSessions` 记录，每轮对话保存 user/assistant `messages`

## 布局

```
┌─────────────────────────────────────────────────────────────┐
│ Header (h-12)                                    [💬 toggle] │
├────────┬──────────┬──────────┬──────────────────────────────┤
│ Build  │ Versions │ Settings │                              │
│ Chat   │ Sidebar  │   Nav    │   Content Panel              │
│ (w-96) │ (w-48)   │ (w-48)   │  (flex-1)                    │
│        │ (admin)  │ 13 tabs  │  各资源编辑面板               │
│ 可折叠  │          │          │                              │
└────────┴──────────┴──────────┴──────────────────────────────┘
```

聊天窗在最左侧，宽度 `w-96`（384px），通过 Header 按钮切换。关闭时不渲染。

## 文件结构

```
web/src/app/api/build-chat/route.ts              — API 入口
web/src/lib/build-chat/execute-stream.ts          — 流式处理主逻辑
web/src/lib/build-chat/system-prompt.ts           — 系统提示词构建
web/src/lib/build-chat/resource-summary.ts        — 资源摘要收集
web/src/lib/build-chat/tools/index.ts             — 工具汇总
web/src/lib/build-chat/tools/tool-tools.ts        — Tools CRUD
web/src/lib/build-chat/tools/schema-tools.ts      — Schemas CRUD
web/src/lib/build-chat/tools/wiki-tools.ts        — Wiki CRUD
web/src/lib/build-chat/tools/dataset-tools.ts     — Datasets CRUD
web/src/lib/build-chat/tools/function-tools.ts    — Functions CRUD
web/src/lib/build-chat/tools/component-tools.ts   — Components CRUD
web/src/lib/build-chat/tools/model-config-tools.ts — Model Config CRUD
web/src/lib/build-chat/tools/chat-config-tools.ts — Chat Config 读写
web/src/lib/build-chat/tools/ontology-tools.ts    — Ontology CRUD
web/src/components/build-chat/build-chat-panel.tsx — 聊天面板 UI
```

## Server Tools 规范

每个 tool 文件导出 `buildXxxTools(agentId: string)` 函数，返回 `Record<string, Tool>` map。

每个资源提供：
- `list_xxx` — 列表（摘要字段）
- `get_xxx` — 详情（含大字段 handler、code、content 等）
- `create_xxx` — 创建
- `update_xxx` — 更新
- `delete_xxx` — 删除

返回值统一包含 `_mutateKeys: string[]`，前端据此刷新 SWR。

## 模型配置

Build 助手和 AI 辅助编辑的模型配置已迁移为组织级内置 Agent，详见 [builtin-agents.md](./builtin-agents.md)。

### Build Chat

- 对应内置 Agent slug: `build-chat`，默认模型 `anthropic/claude-sonnet-4`，温度 0.3
- 服务端通过 `getBuiltinAgentConfig(orgId, "build-chat")` 查询，带 60s 内存缓存
- 用户在 agent 详情页的 Model Configs 标签中编辑模型和温度

### AI 辅助编辑

所有 AI 辅助编辑功能（Prompt Assist、JSX Assist、Function Code Assist、Schema Code Assist、Tool Code Assist、Dataset Assist、Wiki Assist）共用一个可配置的模型。

- 对应内置 Agent slug: `assist`，默认模型 `anthropic/claude-sonnet-4`，温度 0.7
- 服务端通过 `getBuiltinAgentConfig(orgId, "assist")` 获取 `.model`
- 7 个 assist 路由均通过 `agentId → getOrgIdByAgentId → getBuiltinAgentConfig → resolveModel` 动态解析模型
- 7 个 assist 路由共用 `createAssistHandler()`，已集成三项监控：用量记录、运行时事件、会话持久化。前端 dialog 组件在打开时重置 `sessionIdRef`，首次发消息时生成 sessionId

### 系统工具

Build Chat 的工具以 `isSystem=true` 标记存储在 `tools` 表中，运行时结合 DB enabled 状态与代码 handler 过滤，详见 [builtin-agents.md](./builtin-agents.md#系统工具)。

## 前端面板

- 复用 `ai-elements/` 组件：Conversation、Message、PromptInput、Suggestion
- `useChat()` 连接 `/api/build-chat`，body 携带 `agentId` 和 `sessionId`
- `onToolCall` 提取 `_mutateKeys` 调用 `globalMutate()`
- 空状态展示欢迎文案 + 常用操作建议按钮
