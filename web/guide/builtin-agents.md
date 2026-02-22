# 功能槽位（Agent Slots）

## 概述

功能槽位是通用的 AI 能力插槽机制，取代之前硬编码的 build-chat/assist 绑定。

每个槽位指向一个 agent，由该 agent 提供 AI 能力（model + temperature）。支持 org 级默认 + agent 级覆盖。

## 槽位定义

| slotKey | 用途 | 默认 agent slug | 默认模型 | 默认温度 |
|---------|------|----------------|----------|----------|
| `builder` | Build Chat 对话助手 | build-chat | anthropic/claude-sonnet-4 | 0.3 |
| `assist` | AI 辅助编辑 | assist | anthropic/claude-sonnet-4 | 0.7 |
| `evaluator` | Agent 评估 | evaluator | anthropic/claude-sonnet-4 | 0.3 |
| `support` | 客服聊天气泡 | support | anthropic/claude-sonnet-4 | 0.7 |

## 数据模型

### orgSlots 表

组织级默认槽位配置，唯一约束 `(orgId, slotKey)`。

### agentSlotOverrides 表

Agent 级槽位覆盖，唯一约束 `(agentId, slotKey)`。无记录时继承 org 默认。

## 解析逻辑

`resolveSlot(agentId, slotKey)`:

1. 查 `agentSlotOverrides(agentId, slotKey)` → 有则返回 targetAgentId
2. 查 agent.orgId → 查 `orgSlots(orgId, slotKey)` → 有则返回 agentId
3. 都没有 → 返回硬编码默认值（SLOT_DEFS）

结果缓存 60s，可通过 `invalidateSlotCache()` 清除。

## 组织初始化

创建组织时 `ensureOrgDefaults(orgId)` 幂等创建：
- 4 个 agent（build-chat、assist、evaluator、support）
- 每个 agent 的默认 modelConfig
- 4 条 orgSlots 记录
- builder agent 的系统工具
- evaluator agent 的默认 judgeConfig
- support agent 的默认 embed token

## 删除保护

引用检查机制：
- 删除 agent 前检查 `orgSlots` 和 `agentSlotOverrides` 是否有引用
- 有引用则返回 409 Conflict
- 用户需先解除引用再删除

## 消费端

- **Build Chat**（`execute-stream.ts`）：使用 `resolveSlot(agentId, "builder")` 获取模型和温度
- **AI 辅助编辑**（`assist-utils.ts`）：使用 `resolveSlot(agentId, "assist")` 获取模型
- **Support Bubble**（`support-bubble.tsx`）：通过 org API 获取 support agent 的 embed token

## UI

### Org 设置页

"功能槽位"Tab，列出所有槽位及当前绑定的 agent，可切换。

### Agent Build 页

"Slots"Tab，显示当前 agent 的槽位配置：
- 继承自 org 或自定义覆盖
- 可切换覆盖 / 恢复继承

## 关键文件

| 文件 | 作用 |
|------|------|
| `web/src/db/schema.ts` | SLOT_KEYS、orgSlots、agentSlotOverrides 表定义 |
| `web/src/lib/slots/constants.ts` | SLOT_DEFS 槽位定义 |
| `web/src/lib/slots/resolve-slot.ts` | resolveSlot() 解析 + 缓存 |
| `web/src/lib/slots/ensure-org-defaults.ts` | ensureOrgDefaults() 组织初始化 |
| `web/src/lib/slots/hooks.ts` | 前端 SWR hooks |
| `web/src/app/api/orgs/[id]/slots/route.ts` | Org 槽位 API |
| `web/src/app/api/agents/[id]/slots/route.ts` | Agent 槽位覆盖 API |
| `web/src/components/orgs/org-slots-panel.tsx` | Org 设置页槽位面板 |
| `web/src/components/slots/agent-slots-panel.tsx` | Agent Build 页槽位面板 |
