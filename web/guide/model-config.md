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

`systemPrompt` 字段支持完整的 LiquidJS 模板语法。运行时（每次聊天开始时）自动渲染。

详细的语法参考、可用变量和 Filter 列表见 [系统提示词编辑参考](prompt-editing.md)。

### 快速参考

| 语法 | 说明 | 示例 |
|------|------|------|
| `{{dataset_key}}` | 数据集变量 | `{{company_name}}` |
| `{{tool.name.description}}` | 工具信息 | `{{tool.calculate_dti.description}}` |
| `{% for t in tool_entries %}` | 遍历工具 | `t.name`、`t.description`、`t.parameters` |
| `{% include 'wiki_key' %}` | 嵌入 Wiki | `{% include '贷款指南' %}` |
| `{{ontology_types}}` | 本体类型 | `{% for type in ontology_types %}...{% endfor %}` |
| `{{host.fieldName}}` | 宿主变量 | `{{host.userName}}` |
| `{{date}}` / `{{time}}` | 内置时间 | `2026-02-21` / `14:30:00` |

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
