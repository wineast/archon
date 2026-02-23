# 组织额度系统 (Org Credits)

## 概述

Archon 平台按 token 计费，组织通过平台额度（USD）使用 AI 能力。额度用完后 AI 功能停用。
**BYOK 组织**（自带 API Key）走自己的 key，不消耗平台额度。

---

## 核心概念

| 概念 | 说明 |
|------|------|
| `creditBalanceUSD` | 组织的额度余额（USD），存储在 `orgs` 表 |
| 自助充值 | 组织 admin 在 Settings → 额度 Tab 自助购买额度（伪支付） |
| 扣减 | 每次 AI 调用后，按实际 token 消耗原子扣减 |
| BYOK 豁免 | 使用自有 API Key 的调用不扣减额度 |

---

## 额度检查流程

`resolveModel()` 是所有 AI 调用的唯一入口：

```
resolveModel(modelId, orgId)
├─ 无 orgId → gateway（不检查额度）
├─ 有 BYOK key → 直连 provider（不检查额度）
└─ 无 BYOK key → 检查额度
   ├─ balance > 0 → gateway（正常使用）
   └─ balance ≤ 0 → 抛出 QuotaExceededError
```

## 额度扣减流程

`recordUsage()` 在记录用量后自动扣减：

1. 计算 `costUSD`（基于 tokenlens 价格表）
2. 判断是否 BYOK（复用 `getOrgApiKey` 缓存）
3. 非 BYOK 且 costUSD > 0 → `UPDATE orgs SET credit_balance_usd = credit_balance_usd - $costUSD`
4. 清除额度缓存

---

## API

### 自助充值（Org admin）

```
POST /api/orgs/{orgId}/credits
Body: { amount: number }
Response: { balance: number }
```

- `amount` 必须为正数
- 交易类型为 `purchase`
- 鉴权：`requireOrgRole(orgId, "admin")`

### Org 查询（Org admin）

```
GET /api/orgs/{orgId}/credits
Response: { balance: number, transactions: [...] }
```

---

## 错误处理

额度不足时 `resolveModel()` 抛出 `QuotaExceededError`，各调用点统一返回 HTTP 402：

```json
{ "error": "quota_exceeded", "message": "平台额度已用完，请联系管理员充值。" }
```

Memory 提取（后台任务）遇到额度不足时静默跳过，不影响主流程。

---

## UI

### Usage Panel 额度卡片

在用量面板顶部显示：
- 剩余额度 / 已消耗
- 进度条（≥95% 红色，≥75% 黄色）
- 余额 ≤ $5 黄色警告，≤ $0 红色"额度已用完"

### Settings → 额度 Tab

独立额度管理页面：
- 当前余额卡片（右上角"充值"按钮）
- 点击充值 → Dialog 选择预设金额（$10 / $50 / $100 / $500）→ 确认支付
- 交易记录表格（时间、金额、类型、说明、交易后余额）
- 交易类型映射：`purchase` → "购买"、`topup` → "充值"、`adjustment` → "调整"

---

## 数据库

### `orgs` 表新增字段

- `credit_balance_usd` (real, default 0) — 当前余额

### `org_credit_transactions` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| org_id | uuid FK → orgs | |
| amount | real | 正=充值/购买，负=调整 |
| type | text | `topup` / `adjustment` / `purchase` |
| description | text | 说明 |
| created_by | uuid FK → users | 操作人 |
| balance_after | real | 交易后余额 |
| created_at | timestamp | |

---

## 文件清单

### 新建
- `web/src/lib/credits/queries.ts` — 额度查询 + 60s 缓存
- `web/src/lib/credits/errors.ts` — QuotaExceededError
- `web/src/app/api/orgs/[id]/credits/route.ts` — Org 额度查询 + 自助充值 API
- `web/src/components/orgs/org-credits-panel.tsx` — 额度管理面板（含 PurchaseDialog）
- `web/src/lib/orgs/credits-hooks.ts` — SWR hooks + purchaseCredits

### 修改
- `web/src/db/schema.ts` — orgs.creditBalanceUSD + orgCreditTransactions 表
- `web/src/lib/ai/resolve-model.ts` — gateway 路径加额度检查，导出 parseModelId
- `web/src/lib/usage/record.ts` — 使用后扣减额度
- `web/src/lib/chat/execute-stream.ts` — 捕获 QuotaExceededError → 402
- `web/src/lib/build-chat/execute-stream.ts` — 同上
- `web/src/app/api/embed/chat/route.ts` — AI 辅助编辑统一走 embed chat 路由
- `web/src/app/api/eval/run/[runId]/case/route.ts` — 同上
- `web/src/lib/memory/extract.ts` — 静默降级
- `web/src/app/[orgSlug]/settings/page.tsx` — 新增"额度"tab
- `web/src/components/orgs/org-usage-panel.tsx` — 顶部额度卡片
