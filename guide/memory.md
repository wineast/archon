# Memory 模块

记忆模块让 Agent 能跨会话记住用户偏好、事实和事件。

## 概念

| 概念 | 说明 |
|------|------|
| **Memory Config** | 每个 Agent 一份记忆策略配置（1:1），控制是否启用、注入方式、衰减等 |
| **Memory** | 具体的记忆条目，可以是用户级或全局级 |
| **Memory Type** | 记忆类型，完全由用户在 Config 中定义（key + label + description） |

## 数据库 Schema

### memoryConfigs 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 关联 Agent（unique，cascade 删除） |
| enabled | boolean | 是否启用记忆 |
| autoExtract | boolean | 是否自动从对话中提取记忆 |
| extractionPrompt | text | 自定义提取 prompt |
| maxMemoriesPerUser | integer | 每用户最大记忆数 |
| maxGlobalMemories | integer | 全局最大记忆数 |
| injectionMode | text | 注入方式：`system_prompt` / `context` / `none` |
| maxInjectedMemories | integer | 每次注入的最大记忆数 |
| decayEnabled | boolean | 是否启用记忆衰减 |
| decayDays | integer | 衰减天数 |
| memoryTypeDefs | jsonb | 记忆类型定义列表，每项 `{key, label, description}` |

### memories 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 关联 Agent（cascade 删除） |
| userId | text | 用户 ID（nullable，为空表示全局记忆） |
| sessionId | uuid | 关联会话（nullable，set null） |
| type | text | 记忆类型 |
| content | text | 记忆内容 |
| importance | real | 重要度 0-1，默认 0.5 |
| lastAccessedAt | timestamp | 最近访问时间 |
| expiresAt | timestamp | 过期时间 |
| metadata | jsonb | 扩展元数据 |
| deletedAt | timestamp | 软删除标记 |

索引：`(agentId, userId)`, `(agentId, type)`

## API

### Memory Config

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/memory-configs?agentId=xxx` | 获取记忆配置 |
| PUT | `/api/memory-configs/[id]` | 更新记忆配置 |

### Memories

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/memories?agentId=xxx&userId=xxx` | 列出记忆（支持 userId 筛选） |
| POST | `/api/memories` | 创建记忆 |
| PATCH | `/api/memories/[id]` | 更新记忆 |
| DELETE | `/api/memories/[id]` | 软删除记忆 |

## SWR Hooks

```ts
import {
  useMemoryConfig, updateMemoryConfig,
  useMemories, createMemory, updateMemory, deleteMemory,
} from "@/lib/memory/hooks";
```

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

## UI

在 Agent Build 页面侧栏中点击 **Memory**（Brain 图标）进入：

- **Config** tab：配置记忆策略（启用、注入模式、衰减等）+ 自定义记忆类型定义
- **Memories** tab：左侧按 userId 分栏（含 All / global / 各用户 + 条数 Badge），右侧为搜索 + 类型过滤 + 记忆表格的 CRUD 管理界面

## 未来规划（P1）

- 运行时自动注入相关记忆到 system prompt
- 对话后自动提取记忆
- 记忆向量化 + 语义检索
- 记忆衰减定时任务
