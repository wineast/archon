# MCP Servers

MCP (Model Context Protocol) Server 模块允许子 Agent 在 chat 运行时连接外部 MCP Server，动态发现和使用工具。

## 概念

- **MCP Server**: 遵循 Model Context Protocol 的外部服务，提供工具供 AI 调用
- **Transport Type**: 连接方式，支持 `sse`（Server-Sent Events）和 `http`（Streamable HTTP）
- **Headers**: 连接时附带的 HTTP 头，用于认证等场景

## 数据库

`mcp_servers` 表，字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 所属 Agent |
| key | text | 唯一标识 (snake_case)，`(agentId, key)` 唯一 |
| name | text | 显示名称 |
| description | text | 描述 |
| url | text | MCP Server URL |
| transportType | text | `"sse"` 或 `"http"` |
| headers | jsonb | `Record<string, string>`，HTTP 头 |
| enabled | boolean | 是否启用 |
| deletedAt | timestamp | 软删除 |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/mcp-servers?agentId=` | 列出 MCP Servers |
| POST | `/api/mcp-servers` | 创建 |
| PATCH | `/api/mcp-servers/[id]` | 更新 |
| DELETE | `/api/mcp-servers/[id]` | 软删除 |
| POST | `/api/mcp-servers/[id]/test` | 测试连接，返回完整工具定义（含 inputSchema） |
| POST | `/api/mcp-servers/[id]/execute` | 执行单个工具，body: `{ toolName, args }` |

## SWR Hooks

文件：`web/src/lib/mcp-servers/hooks.ts`

- `useMcpServers(agentId)` — 列表
- `useMcpServer(id)` — 单条
- `createMcpServer(data, mutate)` — 创建
- `updateMcpServer(id, data, mutate)` — 更新
- `deleteMcpServer(id, mutate)` — 删除
- `testMcpServer(id)` — 测试连接，返回 `TestMcpServerResult`（含 `McpToolDef[]`）
- `executeMcpTool(serverId, toolName, args)` — 执行单个 MCP 工具

## Build Chat 工具

文件：`web/src/lib/build-chat/tools/mcp-server-tools.ts`

6 个工具：`list_mcp_servers`、`get_mcp_server`、`create_mcp_server`、`update_mcp_server`、`delete_mcp_server`、`test_mcp_server`

## Chat 运行时集成

文件：`web/src/lib/chat/execute-stream.ts`

运行时行为：
1. 查询当前 Agent 所有 `enabled=true` 且未删除的 MCP Server
2. 使用 `@ai-sdk/mcp` 的 `createMCPClient` 并行连接所有服务器
3. 获取每个服务器的工具，加 `mcp_{serverKey}__` 前缀防命名冲突
4. 合并到 `allTools` 传给 `streamText`
5. 连接失败记录 `mcp_connect_error` runtime event，不阻断聊天
6. `onFinish` 后异步关闭所有 MCP client

## 版本快照

`McpServerSnapshotItem` 包含：key、name、description、url、transportType、headers、enabled

build/restore 时与其他资源一同处理。

## UI

Build 页面 → MCP tab（`PlugIcon`）

组件目录：`web/src/components/mcp-servers/`

| 组件 | 说明 |
|------|------|
| `McpServersPanel` | 双栏布局主面板 |
| `McpServersSidebar` | 左侧列表 |
| `McpServerDetail` | 右侧详情，Edit / Playground 双 Tab 布局（`variant="line"`） |
| `McpToolPlayground` | Playground Tab：左侧工具列表 sidebar + 右侧参数/结果面板 |
| `McpServerForm` | react-hook-form 表单 |
| `McpServerCreateDialog` | key+name 创建对话框 |
| `McpServersEmptyState` | 空状态提示 |

## Test Connection

点击 "Test" 按钮，后端会：
1. 用 `createMCPClient` 连接到 MCP Server
2. 调用 `client.listTools()` 获取完整工具定义（含 `inputSchema`）
3. 返回 `{ ok, tools: McpToolDef[], toolCount }` 或 `{ ok: false, error }`

成功时 toast 显示工具数量，并自动切换到 Playground Tab。

## Tool Playground

MCP Server 详情页的独立 Tab（与 Edit Tab 并列，`variant="line"` 导航级 Tabs）。Test 连接成功后自动切换至此。

### 布局

采用左右分栏模式（与 tools-panel 的 sidebar + detail 模式一致）：

- **左侧 sidebar**（`w-48 shrink-0 border-r`）：工具列表，点击选中，选中态 `bg-muted font-medium`
- **右侧面板**（`flex-1`）：ScrollArea 包裹工具描述 + 参数表单 + 结果展示，底部固定 Run 按钮

未 Test 连接时，Playground Tab 显示空状态引导："Please click Test on the Edit tab to connect to the MCP server first."

### 功能

1. **选择工具**：从左侧列表点击选择工具
2. **查看描述**：展示工具的 description
3. **填写参数**：根据 `inputSchema.properties` 动态生成表单
   - `string` → 文本输入
   - `number` / `integer` → 数字输入
   - `boolean` → Switch 开关
   - `string` + `enum` → Select 下拉
   - 其他复杂类型（object/array）→ JsonEditor 可编辑模式
4. **执行工具**：点击 "Run" 调用 Execute API
5. **查看结果**：JsonEditor readOnly 展示；失败时红色 Alert 显示错误信息

### 相关文件

| 文件 | 说明 |
|------|------|
| `web/src/components/mcp-servers/mcp-tool-playground.tsx` | Playground 组件 |
| `web/src/app/api/mcp-servers/[id]/execute/route.ts` | Execute API |
| `web/src/lib/mcp-servers/hooks.ts` | `executeMcpTool` 函数 + `McpToolDef` 类型 |

## MCP 总开关

每个 Agent 拥有独立的 MCP 总开关 `mcpEnabled`（`agents.mcp_enabled`，默认 `true`）。

### UI 位置

MCP Servers 面板侧边栏头部，标题与 "+" 按钮之间的 Switch 开关。

### 关闭后的效果

- Chat 运行时跳过 MCP Server 连接逻辑（不查询、不连接、不注入工具）
- MCP Servers 配置数据保留，可继续编辑管理
- 版本快照中已有的 MCP 数据保留不受影响

### 相关文件

| 文件 | 说明 |
|------|------|
| `web/src/db/schema.ts` | `agents.mcpEnabled` 字段 |
| `web/src/app/api/agents/[id]/route.ts` | PUT 支持 `mcpEnabled` 更新 |
| `web/src/components/mcp-servers/mcp-servers-sidebar.tsx` | Switch 开关 UI |
| `web/src/components/mcp-servers/mcp-servers-panel.tsx` | 读取 agent.mcpEnabled、调用 API 切换 |
| `web/src/lib/chat/execute-stream.ts` | 运行时守卫：`mcpEnabled=false` 时跳过 MCP |
