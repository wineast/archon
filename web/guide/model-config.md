# 模型配置（Model Config）

模型配置模块允许为 Agent 创建多套 LLM 配置，支持在不同配置间切换。

## 概念

| 概念 | 说明 |
|------|------|
| **Model Config** | 一套模型配置，包含模型 ID、系统提示词、温度 |
| **Active Config** | 当前激活的配置，Agent 运行时使用此配置 |

## 数据库 Schema

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 关联 Agent |
| key | text | 配置唯一标识 |
| name | text | 配置名称 |
| modelId | text | 模型 ID（如 `anthropic/claude-opus-4`） |
| systemPrompt | text | 系统提示词 |
| temperature | real | 温度（默认 0.7） |
| isActive | boolean | 是否为当前激活配置 |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/model-configs?agentId=xxx` | 列出所有配置 |
| POST | `/api/model-configs` | 创建配置 |
| PATCH | `/api/model-configs/[id]` | 更新配置 |
| DELETE | `/api/model-configs/[id]` | 删除配置 |
| GET | `/api/model-configs/active?agentId=xxx` | 获取激活配置 |
| POST | `/api/model-configs/[id]/activate` | 激活指定配置 |

## 系统提示词模板

`systemPrompt` 字段支持完整的 LiquidJS 模板语法。运行时（每次聊天开始时）自动渲染，注入以下数据源：

| 语法 | 说明 | 示例 |
|------|------|------|
| `{{dataset_key}}` | 数据集变量 | `{{company_name}}` → `"GMCC"` |
| `{{dataset_key.field}}` | 数据集对象属性 | `{{income_type_enum.w2}}` |
| `{{tool_names}}` | 所有启用工具名逗号拼接 | `"calculate_dti, route_products"` |
| `{{tool.name.description}}` | 单个工具信息 | `{{tool.calculate_dti.description}}` |
| `{% for t in tool_entries %}` | 遍历所有工具 | 每个条目有 `t.name`、`t.description`、`t.params` |
| `{% for p in tool.name.parameters %}` | 遍历工具参数 | `p.name`、`p.type`、`p.description`、`p.required` |
| `{% include 'wiki_key' %}` | 嵌入 Wiki 文档 | `{% include '贷款指南' %}` |
| `{{ontology_types}}` | 本体类型列表 | `{% for type in ontology_types %}...{% endfor %}` |
| `{{host.fieldName}}` | 宿主上下文（embed 模式） | `{{host.userName}}` |
| `{{date}}` / `{{time}}` | 内置时间变量 | `2026-02-21` / `14:30:00` |
| `{% if %}` / `{% for %}` | 条件 / 循环 | 完整 LiquidJS 语法 |

### 示例

```liquid
你是 {{company_name}} 的 AI 顾问。今天是 {{date}}。

## 可用工具
{% for t in tool_entries %}
- **{{t.name}}**：{{t.description}}
{% endfor %}

## 业务知识
{% include 'company_policies' %}
{% include 'product_faq' %}
```

### 渲染时机

系统提示词在每次聊天开始时渲染一次，注入当时的所有数据。数据源加载顺序：

1. 数据集（拓扑排序渲染）
2. Wiki 文档（原始加载，按需渲染）
3. 工具定义（构建 tool 命名空间）
4. 本体类型（构建 ontology 命名空间）
5. Skills 摘要（追加到提示词末尾）

详见 [模板引擎文档](template-engine.md)。

---

## UI

在 Agent Build 页面侧栏中点击 **Model Config**（设置图标）进入：

- 左侧侧栏：配置列表（激活项显示绿色标记）
- 右侧详情：编辑模型 ID、系统提示词、温度，支持激活/删除
