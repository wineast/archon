# 缺陷报告：Eval Run 创建时配置快照查询缺少事务隔离

> 诊断时间：2026-03-02 21:00
> 环境：dev | 代码审计 | 分支 `dev-eval-run-config-snapshot-no-transaction-20260302`

## 1. Delta（偏差）

### 期望行为（Should Be）
Eval Run 创建时，配置快照（agent modelConfig、judge modelConfig、judgeConfig）应在同一个数据库事务中读取，确保快照组合的原子性——要么全部读到修改前的配置，要么全部读到修改后的配置。

### 实际行为（Is）
5 次独立 `await db.select()` 顺序执行，无事务包裹。如果在查询间隙有并发修改（如切换 judge agent 的 active modelConfig），不同查询可能读到不同时间点的配置，导致快照组合不一致。

### 偏差描述
配置快照查询缺少事务隔离，并发修改时可能产生"judgeModelConfig 是旧配置 A + judgeConfig 是新配置 B"的不一致组合，导致 eval run 使用错误的配置进行评测。

## 2. Reproduction Path（复现路径）

### 环境与前置条件
- 需要两个并发操作：一个发起 eval run，另一个修改 judge agent 配置
- 代码路径级别的竞态条件，无法通过单用户 UI 操作稳定复现

### 不一致窗口分析

**`run/route.ts` 查询序列**（5 次独立查询）：

```
Query 1: resolveEditingVersionId(agentId)        → agents 表        [L57]
Query 2: db.select().from(modelConfigs)           → agent modelConfig [L58-67]
  ──── 窗口 A：此处若 agent 切换 active modelConfig，Q2 和 Q1 不一致 ────
Query 3: resolveEditingVersionId(judgeAgentId)    → agents 表        [L77]
Query 4: db.select().from(modelConfigs)           → judge modelConfig [L78-87]
  ──── 窗口 B：此处若 judge 切换 active modelConfig，Q4 和 Q5 不一致 ────
Query 5: db.select().from(judgeConfigs)           → judgeConfig      [L97-106]
```

**`batch/route.ts`** 同样的 5 次查询（L60-110），外加 batch 创建 + N 次 run 创建循环也不在事务中。

### 复现证据

此缺陷为代码结构级并发问题，通过代码审计确认：

**run/route.ts L56-106** — 5 次独立查询无事务包裹：
```typescript
// Query 1: resolve agent version (独立查询)
const versionId = await resolveEditingVersionId(agentId);
// Query 2: agent modelConfig (独立查询)
const [modelConfig] = await db.select().from(modelConfigs).where(...);
// Query 3: resolve judge version (独立查询)
const judgeVersionId = await resolveEditingVersionId(judgeAgentId);
// Query 4: judge modelConfig (独立查询)
const [judgeModelConfig] = await db.select().from(modelConfigs).where(...);
// Query 5: judgeConfig (独立查询)
const [judgeConfig] = await db.select().from(judgeConfigs).where(...);
```

**对比项目中已有的事务用法**（证明 `db.transaction()` 可用）：
- `invitation-codes/consume/route.ts:20` — `await db.transaction(async (tx) => {...})`
- `agents/import/route.ts:88` — `await db.transaction(async (tx) => {...})`
- `agents/[id]/versions/route.ts:93` — `await db.transaction(async (tx) => {...})`

## 3. Location（定位）

### 功能模块
Eval 评测系统 — Run 创建 / Batch 创建

### 代码定位
- `web/src/app/api/eval/run/route.ts:56-106` — 5 次独立 db.select()，无事务
- `web/src/app/api/eval/batch/route.ts:60-110` — 同样的 5 次独立查询
- `web/src/lib/versions/resolve.ts:9-21` — `resolveEditingVersionId()` 不接受 `tx` 参数，无法在外层事务中使用

### 根因分析

根因有两层：

1. **直接原因**：配置快照的 5 次查询是独立的 `await db.select()`，没有包在 `db.transaction()` 中。Postgres 默认隔离级别（Read Committed）下，每条查询看到的是该语句开始时的已提交数据，不同语句之间可以看到其他事务的提交。

2. **间接原因**：`resolveEditingVersionId()` 函数直接使用顶层 `db` 实例，不接受事务上下文（`tx`）参数。即使外层想包事务，也无法将 version 解析纳入同一事务。

```typescript
// web/src/lib/versions/resolve.ts:9-21
export async function resolveEditingVersionId(agentId: string): Promise<string> {
  const [agent] = await db  // ← 直接用顶层 db，不支持 tx
    .select({ editingVersionId: agents.editingVersionId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);
  // ...
}
```

## 4. Impact（影响）

### 严重度
次要（Minor）

### 影响范围
- 单用户场景：概率极低（需要毫秒级并发时序）
- 多人协作 / Batch 模式：概率升高，特别是 batch 会创建多个 run，查询窗口更长
- 自动化场景（API 调用）：如果有自动化脚本在修改配置的同时触发评测，风险进一步增大

### 影响描述
Eval Run 可能使用不一致的配置组合进行评测——例如 judgeModelConfig 用的是旧模型配置 A，但 judgeConfig 用的是新评测维度 B。评测结果的可信度受损，且难以排查（快照已写入 DB，看起来是"正常"的配置组合）。

## 修复方向

将配置快照的全部查询包入 `db.transaction()` 中，确保读取一致性。

### 具体改动

1. **改造 `resolveEditingVersionId`**：增加可选 `tx` 参数（Drizzle 支持传入 `tx` 替代 `db`）
   ```typescript
   export async function resolveEditingVersionId(
     agentId: string,
     tx?: typeof db  // 可选事务上下文
   ): Promise<string> {
     const conn = tx ?? db;
     const [agent] = await conn.select(...).from(agents).where(...);
     // ...
   }
   ```

2. **run/route.ts**：将 5 次配置查询 + run 创建包入 `db.transaction()`
   ```typescript
   const run = await db.transaction(async (tx) => {
     const versionId = await resolveEditingVersionId(agentId, tx);
     const [modelConfig] = await tx.select().from(modelConfigs).where(...);
     const judgeVersionId = await resolveEditingVersionId(judgeAgentId, tx);
     const [judgeModelConfig] = await tx.select().from(modelConfigs).where(...);
     const [judgeConfig] = await tx.select().from(judgeConfigs).where(...);
     // ... validation ...
     const [run] = await tx.insert(evalRuns).values({...}).returning();
     return run;
   });
   ```

3. **batch/route.ts**：同样改造，将配置查询 + batch 创建 + N 次 run 创建全部包入事务

### 风险
- 事务范围增大会延长行级锁持有时间，但这些都是读操作（SELECT），Postgres 读操作不加行锁
- `resolveEditingVersionId` 的 `tx` 参数改为可选，向后兼容，不影响其他调用方

### 验收标准
- Given 配置快照查询代码, When 审查事务使用, Then 所有配置读取和 run/batch 创建在同一个 `db.transaction()` 中
- Given `resolveEditingVersionId`, When 被 eval run/batch 调用, Then 使用传入的 `tx` 而非顶层 `db`
- Given 现有单元测试/E2E 测试, When 运行 `make test` / `make typecheck`, Then 全部通过

## 过程备注

- [确认] 项目已有 `db.transaction()` 使用先例（invitation-codes、agent-import、versions），Drizzle ORM 事务 API 已验证可用
- [确认] `resolveEditingVersionId` 不接受 `tx` 参数是间接原因，需一并改造
- [确认] batch/route.ts 的循环创建 N 个 run 也不在事务中，问题更突出——循环期间配置可能变化导致不同 run 的快照不一致
