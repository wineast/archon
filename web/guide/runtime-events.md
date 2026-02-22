# 运行时事件（Runtime Events）

运行时事件模块用于监控 Agent 运行过程中的 LLM 调用、工具执行等事件。

## 事件类型

| 类型 | 说明 |
|------|------|
| `llm_call` | LLM 调用 |
| `tool_call` | 工具调用 |
| `tool_error` | 工具执行错误 |
| `tool_timeout` | 工具执行超时 |
| `tool_output_validation` | 工具输出校验失败 |
| `stream_error` | 流式传输错误 |
| `mcp_connect_error` | MCP Server 连接失败 |

## 严重级别

| 级别 | 说明 |
|------|------|
| `info` | 信息（正常调用记录） |
| `warning` | 警告（如工具执行缓慢） |
| `error` | 错误（如调用失败） |

## 数据库 Schema

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 关联 Agent |
| sessionId | uuid | 关联会话 |
| eventType | text | 事件类型 |
| severity | text | 严重级别 |
| metadata | jsonb | 事件元数据（工具名、模型 ID、token 数等） |
| durationMs | integer | 执行耗时（毫秒） |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents/[id]/runtime-events` | 列出运行时事件 |

查询参数：`eventType`、`severity`、`from`、`to`、`cursor`、`limit`

## 埋点位置

所有 LLM 调用场景均在 `onFinish` 的 `after()` 中记录 `llm_call` 事件：

1. **execute-stream.ts** — 主对话 + embed 对话（含 tool_call / stream_error / mcp_connect_error 等事件）
2. **build-chat/execute-stream.ts** — Build Chat 配置助手
3. **assist-utils.ts** — 7 个 AI Assist 路由共用（prompt/tool-code/wiki/function-code/dataset/schema-code/jsx）

## MCP 工具运行时日志

MCP 工具调用与普通工具一样记录 `tool_call` / `tool_error` / `tool_timeout` 事件。

实现文件：`web/src/lib/chat/wrap-mcp-tool.ts`

MCP 工具的 `execute` 函数在合并进 `allTools` 前通过 `wrapMcpExecuteWithTiming` 包装，与普通工具的 `wrapExecutorWithTiming` 模式一致。

metadata 额外包含：

| 字段 | 说明 |
|------|------|
| `serverKey` | MCP Server 的 key 标识 |
| `serverId` | MCP Server 的 UUID |

toolName 格式为 `mcp_{serverKey}__{originalToolName}`，与运行时传给 LLM 的工具名一致。

## UI

在 Agent Build 页面侧栏中点击 **Runtime**（活动图标）进入：

- 顶部筛选：时间范围、事件类型、严重级别
- 事件列表：无限滚动加载，展示事件类型、严重级别、耗时、元数据
