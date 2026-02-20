# 工具（Tools）模块

工具是 Agent 在对话中可以调用的能力单元。每个工具定义了输入参数、处理逻辑和输出格式。

## 概念

| 概念 | 说明 |
|------|------|
| **Tool** | 一个可调用的工具，包含 key、名称、描述、参数 schema、handler |
| **Handler** | 工具执行逻辑，JavaScript 代码，在沙盒中运行 |
| **Parameters Schema** | 输入参数定义，关联 Schema 模块 |
| **Return Schema** | 返回值定义，关联 Schema 模块 |
| **Component** | 工具结果的可视化渲染组件，关联 Components 模块 |

## 数据库 Schema

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 关联 Agent |
| key | text | 工具唯一标识（同 Agent 内唯一） |
| name | text | 工具名称 |
| description | text | 工具描述（供 LLM 理解何时调用） |
| parametersSchemaId | uuid | 输入参数 Schema |
| returnParametersSchemaId | uuid | 返回值 Schema |
| handler | text | JavaScript handler 代码 |
| url | text | 外部 API 地址（与 handler 二选一） |
| componentId | uuid | 关联的 UI 组件 |
| enabled | boolean | 是否启用 |
| executionTarget | text | 执行位置：`server` / `client` / `host` |
| sandboxMode | text | 沙盒模式：`light`（QuickJS）/ `full`（Vercel Sandbox） |

## 沙盒模式

| 模式 | 引擎 | 特点 |
|------|------|------|
| **light** | QuickJS | 轻量、快速，适合纯逻辑 + ToolContext 调用 |
| **full** | Vercel Sandbox | 支持 npm 包、复杂操作，启动较慢 |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tools?agentId=xxx` | 列出所有工具 |
| POST | `/api/tools` | 创建工具 |
| PATCH | `/api/tools/[id]` | 更新工具 |
| DELETE | `/api/tools/[id]` | 软删除工具 |

## UI

在 Agent Build 页面侧栏中点击 **Tools**（扳手图标）进入：

- 左侧侧栏：工具列表，支持搜索和创建
- 右侧详情：工具编辑（基本信息、参数 Schema、Handler、组件绑定、测试用例）
