# Agent Slots 与资源共享池

## 概述

两项架构升级：
1. **Agent Slots**：通用的"功能槽位"机制，org 级默认 + agent 级覆盖，取代硬编码的 build-chat/assist 绑定
2. **资源共享池**：全局资源池，所有 agent 可引用池中资源，取代当前的 agent 私有资源模型

---

## Part 1: Agent Slots ✅ 已实现

### 概念

"槽位"是 agent 构建/运行时需要的 AI 能力插槽。每个槽位指向一个 agent，由该 agent 提供 AI 能力。

初始槽位：

| slotKey | 用途 | 默认 agent | 输出模式 |
|---------|------|-----------|----------|
| `builder` | Build Chat 对话助手 | build-chat | stream |
| `assist` | AI 辅助编辑 | assist | stream |
| `evaluator` | Agent 评估 | evaluator | structured |

### Scope 简化

去掉 `user` scope，只保留 `platform | org`：
- 用户创建的 agent → `scope: "org"`（默认值改为 "org"）
- 系统创建和用户创建一视同仁，不再有 `isBuiltin` / 删除保护
- `scope: "platform"` 仅用于 archon-support 等全局 agent

### 数据模型

#### orgSlots 表

组织级默认槽位配置。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| orgId | UUID FK | 关联组织 |
| slotKey | TEXT | 槽位标识（builder/assist/evaluator） |
| agentId | UUID FK | 指向的 agent |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

唯一约束：`(orgId, slotKey)`

#### agentSlotOverrides 表

Agent 级槽位覆盖。无记录时继承 org 默认。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| agentId | UUID FK | 覆盖所属的 agent |
| slotKey | TEXT | 槽位标识 |
| targetAgentId | UUID FK | 覆盖指向的 agent |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

唯一约束：`(agentId, slotKey)`

### 解析逻辑

```
resolveSlot(agentId, slotKey):
  1. 查 agentSlotOverrides(agentId, slotKey) → 有则返回 targetAgentId
  2. 查 agent.orgId → 查 orgSlots(orgId, slotKey) → 有则返回 agentId
  3. 都没有 → 返回 null（使用硬编码默认值）
```

### 删除保护

不再按 scope 判断，改为引用检查：
- 删除 agent 前检查 `orgSlots` 和 `agentSlotOverrides` 是否有引用
- 有引用则返回 409 Conflict，附带引用详情
- 用户需先解除引用再删除

### 消费端改造

#### Build Chat
```
executeBuildChatStream(agentId):
  builderAgentId = resolveSlot(agentId, "builder")
  config = getAgentModelConfig(builderAgentId)  // 直接查 agent 的 active modelConfig
  tools = ... // 工具过滤逻辑不变
```

#### Assist
```
createAssistHandler(agentId):
  assistAgentId = resolveSlot(agentId, "assist")
  config = getAgentModelConfig(assistAgentId)
```

#### Evaluator（未来）
```
runEval(agentId):
  evalAgentId = resolveSlot(agentId, "evaluator")
  config = getAgentModelConfig(evalAgentId)
  // structured output, not streaming
```

### 组织初始化变更

创建组织时：
1. 创建 build-chat、assist、evaluator 三个 agent（`scope: "org"`）
2. 创建 orgSlots 记录：`{ builder → build-chat, assist → assist, evaluator → evaluator }`

### UI

#### Org 设置页
新增"功能槽位"Tab，列出所有槽位及当前绑定的 agent，可切换。

#### Agent Build 页
设置导航中新增"槽位"项，显示当前 agent 的槽位配置（继承自 org 或自定义覆盖）。

### 清理

- 删除 `RESERVED_SLUGS` 常量和保留 slug 校验
- 删除 `scope: "org"` 删除保护
- `getBuiltinAgentConfig()` → `getAgentModelConfig(agentId)`（通用查询任意 agent 的 active modelConfig）
- `ensureBuiltinAgents()` → `ensureOrgDefaults()`（创建默认 agent + 设置 orgSlots）

---

## Part 2: 资源共享池

### 概念

全局共享池，所有资源类型（Tools、Components、Functions、Datasets、Wiki、Schemas、MCP Servers）都支持。

资源分两种存在形态：
- **池资源**：`agentId = NULL`，存在于全局池中，任何 agent 可引用
- **私有资源**：`agentId = X`，归属特定 agent，仅该 agent 可用（现有行为）

### origin 字段

所有资源表新增 `origin` 字段：

| origin | 含义 | 可编辑 | 示例 |
|--------|------|--------|------|
| `builtin` | 平台内置 | 否 | build-chat 系统工具 |
| `user` | 用户创建 | 是 | 用户自己写的工具 |
| `marketplace` | 市场安装 | 否（发布者维护） | 未来市场工具 |

### 数据模型

#### 资源表变更

所有含 `agentId` 的资源表：
- `agentId` 改为 **nullable**（`NULL` = 池资源）
- 新增 `origin: text("origin").notNull().default("user")`
- 删除 `agentId` 上的 cascade delete（池资源不跟 agent 删除）

受影响的表：`tools`、`components`、`functions`、`datasets`、`wikiDocuments`、`schemas`、`mcpServers`

不受影响的表（保持 agent 私有）：`chatConfigs`、`modelConfigs`、`evalCases`、`evalJudgeConfigs`、`chatSessions`、`memories`、`skills`、`embedTokens` 等

#### agentResourceRefs 表

Agent 引用池资源的关联表。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| agentId | UUID FK | 引用方 agent |
| resourceType | TEXT | 资源类型（tool/component/function/dataset/wiki/schema/mcp-server） |
| resourceId | UUID | 池资源 ID |
| enabled | BOOLEAN | 是否启用（默认 true） |
| createdAt | TIMESTAMP | 引用创建时间 |

唯一约束：`(agentId, resourceType, resourceId)`

### Agent 的可用资源

Agent 运行时可用的资源 = 私有资源 + 引用的池资源（enabled=true）

```sql
-- 获取 agent X 的所有可用工具
SELECT * FROM tools WHERE agentId = :agentId
UNION ALL
SELECT t.* FROM tools t
  JOIN agent_resource_refs r ON r.resourceId = t.id
  WHERE r.agentId = :agentId
    AND r.resourceType = 'tool'
    AND r.enabled = true
    AND t.agentId IS NULL
```

### API 设计

#### 池资源 CRUD
- `GET /api/pool/tools` — 列出池中所有工具
- `POST /api/pool/tools` — 创建池工具（admin）
- `PATCH /api/pool/tools/[id]` — 编辑池工具
- `DELETE /api/pool/tools/[id]` — 删除池工具（检查引用）

其他资源类型类推。

#### Agent 引用管理
- `GET /api/agents/[id]/refs` — 该 agent 引用的池资源列表
- `POST /api/agents/[id]/refs` — 添加引用
- `DELETE /api/agents/[id]/refs/[refId]` — 移除引用
- `PATCH /api/agents/[id]/refs/[refId]` — 切换 enabled

### UI

#### 资源浏览器
Agent Build 页面中，每个资源 Tab（如 Tools）增加"从共享池添加"入口：
- 弹出 Dialog 展示池中该类型的所有资源
- 已引用的标记为已添加
- 点击"添加"创建 agentResourceRef

#### 池管理（Admin 或 Org Settings）
- 池资源的 CRUD 界面
- 查看引用情况（哪些 agent 在用）

### 迁移策略

1. 现有 `isSystem=true` 的工具 → 迁移为 `origin: "builtin"` 的池资源
2. 现有 agent 私有资源不变（`agentId` 保持不变）
3. build-chat 的系统工具从"每 org 各一份"变为"全局池中一份 + 各 org 的 build-chat agent 引用"

---

## 工作区拆分

### WS-1: agent-slots（基础，必须先做）

- schema: orgSlots、agentSlotOverrides 表，scope 简化
- `resolveSlot()` 工具函数
- `ensureOrgDefaults()` 替代 `ensureBuiltinAgents()`
- 消费端改造（execute-stream、assist-utils）
- 删除保护改为引用检查
- 清理 RESERVED_SLUGS、getBuiltinAgentConfig
- Org 设置页"功能槽位"Tab
- Agent 设置页槽位覆盖 UI

### WS-2: resource-pool（依赖 WS-1 合并后）

- schema: 资源表 agentId nullable + origin 字段 + agentResourceRefs 表
- 池资源 CRUD API
- Agent 引用管理 API
- 迁移 isSystem 工具到池资源
- 资源查询改造（UNION 私有 + 引用）
- 资源浏览器 UI（"从共享池添加"）
- 池管理 UI

### 未来（不在本次范围）

- evaluator agent 的 structured output 支持
- 市场（marketplace）
- 导入/导出（复制池资源到 agent）
