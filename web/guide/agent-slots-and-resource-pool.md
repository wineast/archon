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

## Part 2: 资源共享池 ✅ 已实现

详细文档见 [resource-pool.md](./resource-pool.md)。

### 概要

全局共享池，支持 7 种资源类型（tool、component、function、dataset、wiki、schema、mcp-server）。资源分两种形态：

- **池资源**：`agentId = NULL`，存在于全局池中，任何 agent 可通过 `agentResourceRefs` 引用
- **私有资源**：`agentId = X`，归属特定 agent，仅该 agent 可用

已完成内容：
- schema：资源表 `agentId` nullable + `origin` 字段 + `agentResourceRefs` 关联表
- 池资源 CRUD API：`GET/POST /api/pool/[resourceType]`，`PATCH/DELETE /api/pool/[resourceType]/[id]`
- Agent 引用管理 API：`GET/POST /api/agents/[id]/refs`，`PATCH/DELETE /api/agents/[id]/refs/[refId]`
- 运行时查询：`getAgentResources()` 等函数合并私有 + 池引用
- Builtin 工具：`ensureBuiltinPoolTools()` + `ensureBuiltinToolRefs()` 自动播种机制
- 权限：池资源操作需 superAdmin，引用操作需 agent editor 角色

---

## 工作区拆分

### WS-1: agent-slots ✅ 已完成

- schema: orgSlots、agentSlotOverrides 表，scope 简化
- `resolveSlot()` 工具函数
- `ensureOrgDefaults()` 替代 `ensureBuiltinAgents()`
- 消费端改造（execute-stream、assist-utils）
- 删除保护改为引用检查
- 清理 RESERVED_SLUGS、getBuiltinAgentConfig
- Org 设置页"功能槽位"Tab
- Agent 设置页槽位覆盖 UI

### WS-2: resource-pool ✅ 已完成

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
