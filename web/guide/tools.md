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
| parametersSchema | jsonb | 输入参数 Schema（内联 JsonSchema7 或 `$ref`，根类型必须为 object） |
| returnParametersSchema | jsonb | 返回值 Schema（内联 JsonSchema7 或 `$ref`，根类型必须为 object） |
| handler | text | JavaScript handler 代码 |
| url | text | 外部 API 地址（与 handler 二选一） |
| componentId | uuid | 关联的 UI 组件（null 时自动使用 `tool-call-default` 兜底） |
| enabled | boolean | 是否启用 |
| uiHidden | boolean | 是否隐藏工具 UI（默认 false，设为 true 时聊天中不渲染任何 UI） |
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

## 跨资源引用

工具是引用其他资源最多的模块，涉及以下引用方式：

### 参数 Schema 中的引用

| 语法 | 说明 | 示例 |
|------|------|------|
| `$ref` | 引用共享 Schema | `{ "$ref": "#/$defs/address_fields" }` |
| `allOf` + `$ref` | 组合多个 Schema | `{ "allOf": [{ "$ref": "#/$defs/a" }, { "$ref": "#/$defs/b" }] }` |
| `"{{key}}"` in enum | 引用数据集作为枚举值 | `{ "enum": ["{{us_states}}"] }` |

`$ref` 使用 Schema 的 `key` 字段（snake_case），格式为 `#/$defs/{schema_key}`。运行时从 defsMap 解析。

### Handler 代码中的引用（ES6 模块格式）

```js
import { wiki, dataset, fn, ontology } from "archon:context";

export default async function(args) {
  const doc = await wiki.get("product-intro");           // Wiki 文档
  const config = await dataset.get("pricing_config");     // 数据集
  const engine = await fn("loan_calculator");             // 函数（运行时获取）
  const types = await ontology.types();                   // 本体
  return engine({ ...args, config });
}
```

| 命名空间 | 用途 | 语法 |
|----------|------|------|
| `archon:context` | 运行时 API（wiki/dataset/fn/ontology） | `import { wiki, dataset, fn, ontology } from "archon:context"` |

### 被其他资源引用

| 引用方 | 语法 | 说明 |
|--------|------|------|
| **System Prompt** | `{{tool_names}}` | 所有启用工具名逗号拼接 |
| **System Prompt** | `{{tool.name.*}}` | 单个工具的名称、描述、参数 |
| **System Prompt** | `{% for t in tool_entries %}` | 遍历所有工具概要 |
| **Skills 内容** | 同上 | 同上 |
| **Wiki 文档** | 同上 | 同上 |

详见 [Handler 编写指南](tool-handler.md) 和 [模块系统文档](../guide/module-system.md)。

---

## UI

在 Agent Build 页面侧栏中点击 **Tools**（扳手图标）进入：

- 左侧侧栏：工具列表，支持搜索和创建
- 右侧详情：工具编辑（基本信息、参数 Schema、Handler、组件绑定、测试用例）

## 相关文档

- [Handler 编写指南](tool-handler.md)
- [沙盒模式](tool-sandbox.md)
- [工具 Examples 功能](tool-examples.md)
- [测试用例断言](tool-test-assertions.md)
- [组件渲染预览](tool-component-preview.md)
