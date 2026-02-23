# 环境变量参考面板

## 概述

Agent 构造页 sidebar 中的**环境变量**面板，以只读表格展示当前 Agent 所有可用的 LiquidJS 模板变量及说明，方便用户在编写系统提示词和 Wiki 模板时快速参考。

## 位置

Sidebar → Datasets 之后，图标为 `VariableIcon`。

## 变量分组

### 时间变量（7 个，静态）

运行时自动注入，无需配置：

| 变量 | 说明 |
|------|------|
| `{{ date }}` | ISO 日期（如 `2026-02-23`） |
| `{{ time }}` | 时间（如 `14:30:00`） |
| `{{ datetime }}` | ISO 日期时间 |
| `{{ timestamp }}` | Unix 毫秒时间戳 |
| `{{ year }}` | 年 |
| `{{ month }}` | 月（补零） |
| `{{ day }}` | 日（补零） |

### 数据集变量（动态）

来自 Agent 的 Datasets，按 key 注入。例如 key 为 `products` 的数据集，模板中用 `{{ products }}` 访问。

面板实时显示当前 Agent 已有的数据集变量列表。

### 工具变量（动态）

来自 Agent 启用的工具：

| 模式 | 说明 |
|------|------|
| `{{ tool.工具key.name }}` | 工具名称 |
| `{{ tool.工具key.description }}` | 工具描述 |
| `{{ tool.工具key.parameters }}` | 参数 Schema |
| `{{ tool_entries }}` | 所有启用工具数组 |

面板列出当前 Agent 启用的工具 key。

### 本体变量（动态）

来自 Agent 的 Ontology 定义：

| 模式 | 说明 |
|------|------|
| `{{ ontology.类型key.name }}` | 实体类型名 |
| `{{ ontology.类型key.description }}` | 实体类型描述 |
| `{{ ontology_types }}` | 所有实体类型数组 |

### 评估变量（仅评估上下文）

| 变量 | 说明 |
|------|------|
| `{{ model }}` | 当前模型 |
| `{{ caseCount }}` | 用例总数 |
| `{{ caseName }}` | 当前用例名 |

### AI 助手上下文变量（仅 Assist Agent 系统提示词）

Assist Agent 的系统提示词通过 LiquidJS 渲染，额外注入以下变量用于区分编辑场景。这些变量统一放在 `host` 命名空间下，与 embed agent 的宿主上下文保持一致：

| 变量 | 说明 |
|------|------|
| `{{ host.fieldContext }}` | 编辑场景标识（如 `wiki-content`、`system-prompt`、`tool-handler` 等） |
| `{{ host.currentContent }}` | 当前编辑器内容 |
| `{{ host.entity }}` | 实体类型标识（如 `content`、`prompt`、`code`） |

`host.fieldContext` 取值：`wiki-content`、`system-prompt`、`tool-handler`、`function-code`、`component-jsx`、`dataset-data`、`schema`

## 交互

- **只读面板**，无增删改操作
- **点击复制**：点击任意变量名即复制到剪贴板，显示 toast 提示"已复制"
- **实时示例**：时间变量显示当前实际值
- 动态变量区域在无数据时显示灰色提示

## 实现

- 组件：`web/src/components/env-vars/env-vars-panel.tsx`
- 数据来源：复用 `useDatasets`、`useTools`、`useObjectTypes` hooks
