# Skills（技能）

## 概述

Skills 是 Agent 的能力提示词资源，采用两步注入机制：

1. **摘要注入系统提示词** — 启用的技能名称和描述会自动追加到聊天系统提示词末尾
2. **按需加载完整内容** — 通过内置工具 `get_skill_detail` 按 `skill_key` 获取完整技能指引

这种设计避免将大量技能内容全部塞入系统提示词，节省 token 开销，同时让 AI 在需要时能获取完整指引。

## 数据结构

| 字段 | 类型 | 说明 |
|------|------|------|
| key | string | 唯一标识，snake_case，同一 Agent 内唯一 |
| name | string | 显示名称 |
| description | string | 技能描述（摘要注入时展示） |
| content | text | 技能完整内容，支持 LiquidJS 模板语法 |
| enabled | boolean | 是否启用（默认 true） |
| order | integer | 排序权重（默认 0，升序） |

## 模块开关

Skills 功能支持 Agent 级别的开关，通过 `agents.skillsEnabled` 字段控制（默认 `true`）。

### 关闭效果

- **Skills 面板** — 显示"Skills 功能未启用"空状态 + 启用按钮
- **Tools 侧边栏** — 不显示 Built-in 区（`get_skill_detail` 内置工具）
- **聊天运行时** — 不查询技能、不注入技能摘要、不注册 `get_skill_detail` 工具
- **Build Chat** — 系统提示词不包含技能摘要、不提供技能管理工具
- **版本快照/回收站/审计日志** — 不受影响，历史数据保留

### 开关操作

- **关闭**：Skills 面板侧边栏顶部 PowerIcon 按钮 → 弹出确认对话框 → 确认后关闭
- **开启**：Skills 面板空状态页面的"启用"按钮

### API

通过 `PUT /api/agents/:id` 更新 `skillsEnabled` 字段：

```json
{ "skillsEnabled": false }
```

## 运行时行为

### 系统提示词追加

当 Agent 有启用的技能时，聊天系统提示词末尾自动追加：

```
## 可用技能
以下技能提供额外能力。需要时调用 get_skill_detail 工具获取完整指引。
- 技能名称 (key: xxx): 技能描述
```

### get_skill_detail 工具

自动注入的内置工具，参数：

- `skill_key` (string) — 技能的 key

返回：

- 成功：`{ name, content }` — content 已经过 LiquidJS 模板渲染
- 失败：`{ error: "技能 xxx 不存在或未启用" }`

## 跨资源引用（LiquidJS 模板）

技能的 `content` 字段支持完整的 LiquidJS 模板语法，可引用以下数据源：

| 语法 | 说明 | 示例 |
|------|------|------|
| `{{dataset_key}}` | 数据集变量 | `{{company_name}}` → `"GMCC"` |
| `{{dataset_key.field}}` | 数据集对象属性 | `{{income_type_enum.w2}}` |
| `{{tool_names}}` | 所有启用工具名 | `"calculate_dti, route_products"` |
| `{{tool.name.*}}` | 单个工具详情 | `{{tool.calculate_dti.description}}` |
| `{% for t in tool_entries %}` | 遍历所有工具 | 每个条目有 `t.name`、`t.description`、`t.params` |
| `{% include 'wiki_key' %}` | 嵌入 Wiki 文档 | `{% include '贷款指南' %}` |
| `{{ontology_types}}` | 本体类型列表 | `{% for type in ontology_types %}...{% endfor %}` |
| `{{host.fieldName}}` | 宿主上下文（embed 模式） | `{{host.userName}}` |
| `{{date}}` / `{{time}}` | 内置时间变量 | `2026-02-21` / `14:30:00` |

> 技能内容在 `get_skill_detail` 被调用时才渲染（懒加载），不是保存时渲染。

详见 [模板引擎文档](template-engine.md)。

## API

### GET /api/skills?agentId=xxx

列出 Agent 的所有技能（不含已删除），按 order 升序、key 升序排列。

### POST /api/skills

创建技能。请求体：`{ agentId, key, name, description?, content?, enabled?, order? }`

### GET /api/skills/:id

获取单个技能详情。

### PATCH /api/skills/:id

更新技能。可更新字段：key, name, description, content, enabled, order。

### DELETE /api/skills/:id

软删除技能（移至回收站）。

## Build Chat 工具

在 Build Chat 中可通过以下工具管理技能：

- `list_skills` — 列出所有技能
- `get_skill` — 获取技能详情
- `create_skill` — 创建技能
- `update_skill` — 更新技能
- `delete_skill` — 删除技能

## 版本快照

技能包含在 Agent 版本快照中，创建版本时自动保存，恢复版本时自动还原。

## UI

在 Build 页面的左侧导航中，Skills 位于 Functions 之后。面板采用左侧列表 + 右侧详情的标准布局。

### 提示词编辑器

技能的 `content` 字段（标签显示为"提示词"）使用 MdEditor（CodeMirror）编辑，支持：

- **LiquidJS 语法高亮** — 变量 `{{ }}` 和标签 `{% %}` 自动着色
- **自动补全** — 输入 `{{` 触发数据集变量、内置变量补全；`{{include "` 触发 Wiki 文档补全；`{{tool.` 触发工具名补全
- **Edit / Preview 切换** — 通过 Tabs 切换编辑和预览模式，Preview 调用 `/api/template/preview` 渲染 LiquidJS 模板
- **AI 编辑** — 点击"AI 编辑"按钮打开 PromptAssistDialog，由 AI 辅助优化提示词内容

### 启用开关

技能的 Enabled/Disabled 开关位于详情页底部操作栏最左侧，与 ToolDetail 的 Toggle 按钮风格一致。启用时显示 `CheckIcon` + "Enabled"，禁用时显示 `PowerIcon` + "Disabled"。

### Tools 联动

当 Agent 有启用的 Skill 时，Tools 侧边栏底部会显示 "Built-in" 分区，展示自动注入的 `get_skill_detail` 内置工具。点击该内置工具可在右侧查看只读详情（名称、描述、参数、返回值）。
