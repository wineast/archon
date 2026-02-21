# 邀请码注册门槛

## 概述

平台通过邀请码限制新用户注册。所有新用户必须输入有效邀请码才能进入注册流程，已注册用户登录不受影响。

## 用户注册流程

1. 用户访问 `/sign-up`，首先看到邀请码输入步骤
2. 输入邀请码后调用 `/api/invitation-codes/verify` 验证
3. 验证通过 → 邀请码存入 `sessionStorage`（key: `pendingInvitationCode`）→ 进入标准注册表单
4. 注册完成后消费邀请码

### 邮箱注册

邮箱验证通过、`setActive()` 成功后，立即调用 `/api/invitation-codes/consume` 消费邀请码，然后清除 sessionStorage 并跳转。

### Google OAuth

用户从 SSO 回调回来后，根布局中的 `<PendingInvitationConsumer />` 组件检测 sessionStorage 中的邀请码，若存在且用户已登录，自动调用 consume API 消费。

## 邀请码格式

- 8 位大写字母 + 数字（如 `A3K7X9M2`）
- 使用 `nanoid` + 自定义字母表 `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` 生成

## 数据库

### invitationCodes 表

| 字段 | 说明 |
|------|------|
| code | 唯一邀请码 |
| label | 备注说明 |
| maxUses | 最大使用次数（null = 不限） |
| usedCount | 已使用次数 |
| expiresAt | 过期时间（null = 永不过期） |
| isActive | 启用/禁用开关 |
| createdBy | 创建者 FK→users |

### invitationCodeUsages 表

| 字段 | 说明 |
|------|------|
| codeId | FK→invitationCodes |
| userId | FK→users |
| usedAt | 使用时间 |

`(codeId, userId)` 唯一约束保证幂等消费。

## API

### 公开路由

- `POST /api/invitation-codes/verify` — 验证邀请码是否有效（无需认证）
  - Body: `{ code: string }`
  - Response: `{ valid: boolean, error?: string }`

### 认证路由

- `POST /api/invitation-codes/consume` — 消费邀请码（需认证）
  - Body: `{ code: string }`
  - 事务内原子操作：FOR UPDATE 锁 → 验证 → usedCount++ → 插入 usages
  - unique 约束保证幂等

### 超管路由

- `GET /api/admin/invitation-codes` — 列出所有邀请码
- `POST /api/admin/invitation-codes` — 创建邀请码（code 自动生成）
  - Body: `{ label?, maxUses?, expiresAt? }`
- `PATCH /api/admin/invitation-codes/:id` — 更新邀请码
  - Body: `{ label?, maxUses?, isActive?, expiresAt? }`
- `DELETE /api/admin/invitation-codes/:id` — 删除邀请码（cascade 删除 usages）

## 超管 UI

管理后台（`/admin`）中的"邀请码管理"区域：

- 邀请码列表：code（可复制）、备注、使用情况（已用/上限）、过期时间、状态 Badge
- 每行：启用/禁用 Switch、删除按钮
- 创建对话框：备注、最大使用次数、过期时间

## 关键文件

| 文件 | 用途 |
|------|------|
| `web/src/db/schema.ts` | invitationCodes + invitationCodeUsages 表定义 |
| `web/src/app/api/invitation-codes/verify/route.ts` | 公开验证 API |
| `web/src/app/api/invitation-codes/consume/route.ts` | 认证消费 API |
| `web/src/app/api/admin/invitation-codes/route.ts` | 超管 GET/POST |
| `web/src/app/api/admin/invitation-codes/[id]/route.ts` | 超管 PATCH/DELETE |
| `web/src/components/auth/sign-up-form.tsx` | 注册表单（含邀请码步骤） |
| `web/src/components/auth/pending-invitation-consumer.tsx` | OAuth 回调消费组件 |
| `web/src/components/admin/invitation-codes-section.tsx` | 超管 UI |
| `web/src/lib/admin/invitation-code-hooks.ts` | SWR hooks + mutation 函数 |
