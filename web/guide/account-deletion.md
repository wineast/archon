# 注销账号

用户可主动发起账号注销，含 7 天恢复期机制。

## 流程

1. **发起注销**：用户菜单 → 「注销账号」 → 输入确认文字 → 确认注销 → 自动登出
2. **恢复期**：7 天内用户可重新登录，看到恢复遮罩，点击「撤销注销」恢复账号
3. **永久删除**：7 天到期后，每日 Cron 任务自动清理——软删除个人组织、硬删除用户行、删除 Clerk 账号

## Schema

`users` 表新增 `deletedAt` 字段：

```
deletedAt: timestamp("deleted_at", { withTimezone: true })
```

- `deletedAt = null`：正常账号
- `deletedAt = 某时间`：待注销，恢复期内

## API

| 路由 | 方法 | 用途 |
|------|------|------|
| `/api/user` | DELETE | 发起注销 |
| `/api/user/recover` | POST | 撤销注销 |
| `/api/user/force-delete` | DELETE | 开发环境立即删除（非生产环境） |
| `/api/cron/cleanup-deleted-users` | GET | 定时清理到期用户（Bearer CRON_SECRET 鉴权） |

## 核心逻辑

`web/src/lib/auth/account-deletion.ts`：

- `ACCOUNT_DELETION_GRACE_DAYS = 7`
- `initiateAccountDeletion(clerkId)` — 设置 `deletedAt = now()`
- `cancelAccountDeletion(clerkId)` — 设置 `deletedAt = null`
- `cleanupDeletedUsers()` — 查找过期用户并永久删除
- `immediateDeleteUser(clerkId)` — 开发环境跳过恢复期直接删除

## UI

- **DeleteAccountDialog**（`components/user/delete-account-dialog.tsx`）：二次确认弹窗，中文输入「注销」/ 英文输入 "DELETE"
- **AccountRecoveryBanner**（`components/user/account-recovery-banner.tsx`）：全屏遮罩，显示恢复倒计时 + 撤销/退出按钮
- **UserMenu**：登出按钮前新增「注销账号」菜单项

## 客户端 Hook

`useCurrentUser()` 新增返回值：

- `mutate` — SWR mutate 函数
- `isPendingDeletion` — 是否待注销
- `deletedAt` — 注销申请时间

## Vercel Cron

`vercel.json` 配置每日 04:00 UTC 执行 `/api/cron/cleanup-deleted-users`。

## 设计决策

- 恢复期内不删 Clerk 账号，用户需能登录来撤回
- 恢复 UI 用客户端遮罩，不需要改 middleware 或新增路由
- 7 天后硬删除 user 行，软删除个人 org（保留 agent 数据可恢复性）
- `ensureUser` 无需修改，返回含 `deletedAt` 的完整 user 对象
