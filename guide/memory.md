# Memory 模块

记忆模块让 Agent 能跨会话记住用户偏好、事实和事件。

## 概念

| 概念 | 说明 |
|------|------|
| **Memory Config** | 每个 Agent 一份记忆策略配置（1:1），控制注入方式、衰减等 |
| **Memory** | 具体的记忆条目，可以是用户级或全局级 |
| **Memory Type** | 记忆类型，完全由用户在 Config 中定义（key + label + description） |

## 数据库 Schema

### agents 表（记忆相关字段）

| 字段 | 类型 | 说明 |
|------|------|------|
| memoryEnabled | boolean | 是否启用记忆功能（默认 false） |

### memoryConfigs 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 关联 Agent（unique，cascade 删除） |
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
  toggleMemoryFeature,
  useMemoryConfig, updateMemoryConfig,
  useMemories, createMemory, updateMemory, deleteMemory,
} from "@/lib/memory/hooks";
```

- `toggleMemoryFeature(agentId, enabled, mutateAgent)` — 切换 agents 表 `memoryEnabled` 开关

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

- 记忆功能开关在 agents 表 `memoryEnabled` 字段，未启用时显示 "记忆功能未启用" + 启用按钮
- **Config** tab：配置记忆策略（注入模式、衰减等）+ 自定义记忆类型定义
- **Memories** tab：左侧按 userId 分栏（含 All / global / 各用户 + 条数 Badge），右侧为搜索 + 类型过滤 + 记忆表格的 CRUD 管理界面

## 运行时记忆注入

聊天时自动将相关记忆注入到 Agent 的上下文中，让 Agent 具备跨会话记忆力。

### 开关守卫

两层开关保护，零开销跳过：

1. `agents.memoryEnabled = false` → 完全跳过，不查询任何记忆相关数据
2. `memoryConfigs.injectionMode = 'none'` → 跳过注入

### 检索策略

代码位于 `web/src/lib/memory/retrieve.ts`：

- 输入：agentId、userId（nullable）、sessionId（可选）
- 查询条件：未删除、未过期、匹配用户级 + 全局记忆
- 排序：importance DESC, lastAccessedAt DESC
- 数量受 `maxInjectedMemories` 限制（默认 10）
- 检索后非阻塞更新 `lastAccessedAt`

### 格式化

代码位于 `web/src/lib/memory/format-for-injection.ts`：

```
<memories>
The following are relevant memories about the user and prior interactions:
- [preference] (user, importance: 0.8) 用户偏好深色主题
- [fact] (global, importance: 0.6) 公司使用 React 技术栈
</memories>
```

### 注入模式

在 `web/src/lib/chat/execute-stream.ts` 中，renderTemplate() 之前执行：

| injectionMode | 行为 |
|---------------|------|
| `system_prompt` | 格式化文本拼接到 system prompt 末尾 |
| `context` | 格式化文本作为额外的 system message 注入（unshift 到消息列表开头） |
| `none` | 不注入 |

## 自动记忆提取

对话结束后，系统自动从聊天内容中提取值得记住的信息，存为记忆条目。

### 开关条件

提取逻辑需要同时满足以下条件才会执行：

1. `agents.memoryEnabled = true`（模块总开关）
2. `memoryConfigs.autoExtract = true`（提取开关）
3. `memoryConfigs.memoryTypeDefs` 至少有一个类型定义

三个条件任一不满足则完全跳过，零 LLM 开销。

### 执行时机

在 `execute-stream.ts` 的 `onFinish` 回调中，通过 `after()` 异步执行，绝不阻塞聊天流式响应。

### 提取流程

```
对话完成 → after() → 检查开关 → 序列化对话 → 调用 LLM（generateObject）→ 去重 → 写入 memories 表
```

1. **序列化对话**：将 UI 消息中 user/assistant 的文本内容拼成 `用户: ... / 助手: ...` 格式
2. **调用 LLM**：使用 `generateObject` + Zod schema，输出结构化的 `[{type, content, importance}]`
3. **去重**：与该 agent+user 已有记忆做字符串级比对（精确匹配 + 子串包含），过滤重复
4. **写入**：批量 insert 到 memories 表，metadata 标记 `{source: "auto_extract"}`

### 代码位置

| 文件 | 说明 |
|------|------|
| `web/src/lib/memory/extract.ts` | 提取逻辑（`extractMemories` + `serialiseConversation`） |
| `web/src/lib/chat/execute-stream.ts` | 聊天流程中的 after() 调用点 |

### 提取 Prompt

`memoryConfigs.extractionPrompt` 为空时使用内置默认 prompt，指导 LLM：
- 识别用户偏好、重要事实、关键决策、反馈意见
- 只提取明确表述的信息，不推测
- 每条记忆独立、自包含、简洁
- 无值得记忆的内容时返回空数组

系统会自动将 `memoryTypeDefs` 附加到 prompt 末尾，约束 LLM 只使用已定义的类型 key。

### 提取模型

当前固定使用 `openai:gpt-4o-mini`（成本低、速度快、结构化输出质量好）。

## 未来规划

- 记忆向量化 + 语义检索（替代当前字符串去重）
- 记忆衰减定时任务
- 提取模型可配置
