# Memory 模块

记忆模块让 Agent 能跨会话记住用户偏好、事实和事件。

## 概念

| 概念 | 说明 |
|------|------|
| **Memory Config** | 每个 Agent 一份记忆策略配置（1:1），控制是否启用、注入方式、衰减等 |
| **Memory** | 具体的记忆条目，可以是用户级或全局级 |
| **Memory Type** | 记忆类型，完全由用户在 Config 中定义（key + label + description） |

## 记忆类型

记忆类型完全由用户在 Config 中自定义，每个类型包含：

| 字段 | 说明 |
|------|------|
| `key` | 类型标识（snake_case），如 `preference`、`fact` |
| `label` | 显示名称，如 "Preference"、"Fact" |
| `description` | 语义描述，告诉 AI 这个类型代表什么 |

UI 提供常用预设作为快捷添加选项（Preference、Fact、Event、Skill、Requirement、Feedback），但所有类型本质上结构统一，用户可自由增删改。

## 配置项

| 配置 | 说明 | 默认值 |
|------|------|--------|
| enabled | 是否启用记忆 | false |
| autoExtract | 是否自动从对话中提取记忆 | false |
| extractionPrompt | 自定义提取 prompt | 空 |
| injectionMode | 注入方式：system_prompt / context / none | system_prompt |
| maxInjectedMemories | 每次注入最大记忆数 | 10 |
| maxMemoriesPerUser | 每用户最大记忆数 | 100 |
| maxGlobalMemories | 全局最大记忆数 | 1000 |
| decayEnabled | 是否启用记忆衰减 | false |
| decayDays | 衰减天数 | 90 |
| memoryTypeDefs | 记忆类型定义列表 `{key, label, description}[]` | [] |

## Build Chat 工具

| 工具 | 说明 |
|------|------|
| `get_memory_config` | 获取记忆配置 |
| `update_memory_config` | 更新/创建记忆配置（upsert） |
| `list_memories` | 列出记忆条目 |
| `get_memory` | 获取单条记忆详情 |
| `create_memory` | 创建记忆 |
| `update_memory` | 更新记忆 |
| `delete_memory` | 软删除记忆 |
