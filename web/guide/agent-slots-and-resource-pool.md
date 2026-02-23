# Agent Slots 与资源共享池

## 概述

两项架构升级：
1. **Agent Slots**：功能槽位机制，分 agent 级和 org 级两层，在每个使用点直接选择 Agent，无继承链
2. **资源共享池**：全局资源池，所有 agent 可引用池中资源

---

## Part 1: Agent Slots ✅ 已实现

### 概念

"槽位"是 agent 构建/运行时需要的 AI 能力插槽。每个槽位指向一个 agent，由该 agent 提供 AI 能力。

槽位分两层：

#### Agent 级槽位（`AgentSlotKey`）

每个 agent 独立配置的槽位，存储在 `agentSlots` 表中。

| slotKey | 用途 | 默认 agent | 使用点 |
|---------|------|-----------|--------|
| `builder` | Build Chat 对话助手 | build-chat | Build Chat 面板顶部选择器 |
| `assist` | AI 辅助编辑 | assist | 各 Assist Dialog 顶部选择器 |
| `evaluator` | Agent 评估 | evaluator | Eval 面板 Judge Agent 选择器 |

#### Org 级槽位（`OrgSlotKey`）

组织级共享槽位，存储在 `orgSlots` 表中。

| slotKey | 用途 | 默认 agent | 使用点 |
|---------|------|-----------|--------|
| `support` | 客服聊天气泡 | support | Build 页面嵌入，Org Settings 配置 |

### 数据模型

#### agentSlots 表

Agent 级槽位绑定。每个 agent 独立配置自己的槽位绑定，未配置的槽位为空。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| agentId | UUID FK | 绑定所属的 agent |
| slotKey | TEXT | 槽位标识（builder/assist/evaluator） |
| targetAgentId | UUID FK | 指向的 agent |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

唯一约束：`(agentId, slotKey)`

#### orgSlots 表

Org 级槽位绑定。每个组织配置共享的槽位绑定。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| orgId | UUID FK | 绑定所属的组织 |
| slotKey | TEXT | 槽位标识（support） |
| targetAgentId | UUID FK | 指向的 agent |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

唯一约束：`(orgId, slotKey)`

### 类型定义

```typescript
// Agent 级槽位
export const AGENT_SLOT_KEYS = ["builder", "assist", "evaluator"] as const;
export type AgentSlotKey = (typeof AGENT_SLOT_KEYS)[number];

// Org 级槽位
export const ORG_SLOT_KEYS = ["support"] as const;
export type OrgSlotKey = (typeof ORG_SLOT_KEYS)[number];

// 全部槽位（联合类型）
export const SLOT_KEYS = [...AGENT_SLOT_KEYS, ...ORG_SLOT_KEYS] as const;
export type SlotKey = AgentSlotKey | OrgSlotKey;
```

### 解析逻辑

```
resolveAgentSlot(agentId, AgentSlotKey):
  1. 查 agentSlots(agentId, slotKey) → 有则返回 targetAgentId + modelConfig
  2. 没有 → 返回 { agentId: null, model: "", temperature: 0 }

resolveOrgSlot(orgId, OrgSlotKey):
  1. 查 orgSlots(orgId, slotKey) → 有则返回 targetAgentId + modelConfig
  2. 没有 → 返回 { agentId: null, model: "", temperature: 0 }
```

未配置时使用点报错提示用户选择 Agent。

### 删除保护

删除 agent 前检查 `agentSlots` 和 `orgSlots` 是否有 `targetAgentId` 引用。有引用则返回 409 Conflict，用户需先解除引用再删除。

### 使用点集成

#### Build Chat
- 面板顶部放 `<SlotAgentSelect slotKey="builder" />`
- 未配置时发送消息返回 422: `{ error: "slot_not_configured" }`

#### Assist
- 各 Assist Dialog 标题栏放 `<SlotAgentSelect slotKey="assist" />`
- 未配置时返回 422: `{ error: "slot_not_configured" }`

#### Evaluator
- Eval 面板 Judge Agent 区域内联 `<SlotAgentSelect slotKey="evaluator" />`
- 未配置时显示警告提示

#### Support Bubble
- 通过 `resolveOrgSlot(orgId, "support")` 获取客服 Agent
- 在 Org Settings → Support tab 中用 `<OrgSlotAgentSelect slotKey="support" />` 配置
- 未配置时不渲染 widget

### 共享组件

#### SlotAgentSelect（Agent 级）

位于 `web/src/components/slots/slot-agent-select.tsx`。

Props:
- `agentId: string` - 当前 agent ID
- `orgId: string` - 当前组织 ID（用于加载可选 agent 列表）
- `slotKey: AgentSlotKey` - 槽位标识
- `className?: string` - 自定义样式
- `onChanged?: () => void` - 选择变更后回调

#### OrgSlotAgentSelect（Org 级）

位于 `web/src/components/slots/org-slot-agent-select.tsx`。

Props:
- `orgId: string` - 当前组织 ID
- `slotKey: OrgSlotKey` - 槽位标识
- `className?: string` - 自定义样式
- `onChanged?: () => void` - 选择变更后回调

两者紧凑样式 `h-7 text-xs`，支持选择"未配置"清除绑定。

### 组织初始化

创建组织时不再自动创建默认 slot agent。如需初始化，通过 fixture JSON 手动导入。

### API

#### Agent Slots API

- `GET /api/agents/[id]/slots` - 获取 agent 的 3 个 agent 级槽位状态
- `PUT /api/agents/[id]/slots` - 创建/更新 agent 级槽位绑定（body: `{ slotKey, targetAgentId }`）
- `DELETE /api/agents/[id]/slots` - 删除 agent 级槽位绑定（body: `{ slotKey }`）

#### Org Slots API

- `GET /api/orgs/[id]/slots` - 获取 org 的 org 级槽位状态
- `PUT /api/orgs/[id]/slots` - 创建/更新 org 级槽位绑定（body: `{ slotKey, targetAgentId }`）
- `DELETE /api/orgs/[id]/slots` - 删除 org 级槽位绑定（body: `{ slotKey }`）

权限：Org Slots API 需要 `admin` 角色。

#### Support Bubble API

- `GET /api/agents/[id]/support-bubble` - 获取 org 级 support 槽位的 agent + embed token

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
