# 组织与租户体系

## 概述

引入 Organization 层，实现多租户隔离。所有 Agent 必须归属某个组织，个人用户注册时自动创建"个人组织"。组织成员权限自动继承到组织下所有 Agent。

## 数据模型

### orgs 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | TEXT | 组织名称 |
| slug | TEXT | URL 标识，唯一 |
| isPersonal | BOOLEAN | 是否为个人组织（注册时自动创建，不可删除） |
| avatarUrl | TEXT (nullable) | 组织头像 |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

### orgMembers 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| orgId | UUID FK | 关联组织 |
| userId | UUID FK | 关联用户 |
| role | ENUM | owner / admin / member |
| createdAt | TIMESTAMP | 加入时间 |

唯一约束：(orgId, userId)

### agents 表变更

- 新增 `orgId` (UUID FK, NOT NULL) — Agent 必须归属组织
- Agent slug 唯一约束改为 (orgId, slug) 联合唯一

### usageRecords 表变更

- 新增 `orgId` (UUID FK, nullable) — 支持组织级用量聚合

## 权限继承策略

组织成员自动获得该组织下所有 Agent 的对应权限：

| 组织角色 | 继承的 Agent 角色 |
|----------|------------------|
| org owner | Agent owner |
| org admin | Agent admin |
| org member | Agent viewer |

`agentMembers` 表仍然保留，可以为特定用户在特定 Agent 上设置**更高**的角色（只能覆盖提升，不能降级）。

有效权限 = max(orgRole 继承的 AgentRole, agentMembers 中显式设置的 AgentRole)

## 用户注册流程变更

1. 用户注册 → Clerk webhook 创建 `users` 记录
2. 自动创建个人组织（`isPersonal=true`，name=用户昵称，slug=用户ID前缀）
3. 用户自动成为个人组织的 owner
4. 后续创建 Agent 默认归属个人组织

## API 设计

### 组织 CRUD
- `GET /api/orgs` — 当前用户的所有组织
- `POST /api/orgs` — 创建组织
- `GET /api/orgs/[id]` — 组织详情
- `PATCH /api/orgs/[id]` — 更新组织信息
- `DELETE /api/orgs/[id]` — 删除组织（不可删除个人组织）

### 组织成员管理
- `GET /api/orgs/[id]/members` — 成员列表
- `POST /api/orgs/[id]/members` — 邀请成员
- `PATCH /api/orgs/[id]/members/[memberId]` — 变更角色
- `DELETE /api/orgs/[id]/members/[memberId]` — 移除成员

### 组织级用量
- `GET /api/orgs/[id]/usage/summary` — 组织用量汇总
- `GET /api/orgs/[id]/usage/daily` — 组织按天用量
- `GET /api/orgs/[id]/usage/by-agent` — 按 Agent 拆分

### Agent 创建变更
- `POST /api/agents` 新增 `orgId` 参数（必填）

## 现有代码影响

### 需要修改的核心函数
- `requireAgentRole()` — 需要检查 org 成员身份，计算继承权限
- `ensureUser()` — 创建用户时自动创建个人组织
- Agent 列表查询 — 按组织过滤
- Agent 创建 — 必须指定 orgId

### UI 变更
- 顶部导航增加组织切换器
- Agent 列表按当前组织过滤
- 组织设置页（成员管理、基本信息）
- 组织级用量 Dashboard

## 内置 Agent

Build 助手和 AI 辅助编辑已迁移为组织级内置 Agent，详见 [builtin-agents.md](./builtin-agents.md)。
