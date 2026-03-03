# 测试守护规约：Eval Run/Batch 配置快照事务隔离

> 生成时间：2026-03-02 22:00
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 关联修复：[FIX_REPORT.md](FIX_REPORT.md)
> 关联验证：[VERIFY_REPORT.md](VERIFY_REPORT.md)
> 分支：`dev-eval-run-config-snapshot-no-transaction-20260302`

## 1. Invariant（不变量）

Eval Run 和 Batch 创建时，配置快照的全部数据库查询（2 次 version 解析 + 3 次配置读取）和写入操作必须在同一个 Repeatable Read 事务中执行，确保跨语句快照一致性。

来源：DEFECT.md Delta 取反——Delta 说"5 次独立查询可能读到不一致配置"，Invariant 说"5 次查询必须共享同一事务快照"。

## 2. Trigger Scenario（触发场景）

### Given
- 系统有 eval run/batch 创建 API
- `run/route.ts` 和 `batch/route.ts` 中有配置快照逻辑

### When
- 检查源代码结构

### Then
- 配置查询和写入全部在 `db.transaction({ isolationLevel: "repeatable read" })` 内
- 事务内使用 `tx` 而非顶层 `db`

**Level**: Unit（源码结构审计）
**来源**: DEFECT.md Path — 此缺陷为代码结构级并发竞态，无法通过 UI 操作稳定复现，通过源码分析验证

## 3. Cause Anchor（根因锚点）

### 故障机制
5 次独立查询在 Postgres Read Committed 下各自拿到执行时刻的快照，并发修改可导致不一致组合。

### 锚点断言
1. `run/route.ts` 包含 `db.transaction(` 且指定 `isolationLevel: "repeatable read"`
2. `batch/route.ts` 包含 `db.transaction(` 且指定 `isolationLevel: "repeatable read"`
3. 事务内所有 `resolveEditingVersionId` 调用传入 `tx` 参数
4. 事务内所有 `select()`/`insert()` 通过 `tx` 调用
5. `resolveEditingVersionId` 导出 `Tx` 类型、接受 `conn` 参数、函数体使用 `conn` 而非 `db`

**Level**: Unit
**来源**: FIX_REPORT.md Root Cause + Change

## 4. Boundary Set（边界集）

| # | 变体 | 来源 | Level |
|---|------|------|-------|
| 1 | `resolveEditingVersionId` 向后兼容（conn 默认值 db） | 验证报告 Boundary | Unit |
| 2 | ConfigError 错误处理（事务内 throw → 外层 catch → 400） | 验证报告 Boundary | Unit |
| 3 | Inngest 事件在事务外发送 | 验证报告 Boundary | Unit |
| 4 | 其他 resolve 函数未被修改（resolvePublishedVersionId 仍用 db） | Root Cause 推导 | Unit |

## 5. Blast Shield（防爆盾）

| # | 区域 | 断言 | 来源 | Level |
|---|------|------|------|-------|
| 1 | 并发检查 | existingRunningBatch 查询在事务外（已知局限，确认位置） | FIX_REPORT Blast Radius | Unit |

## 6. Coverage Matrix（覆盖矩阵）

| 守护元素 | 测试用例 | 层级 | 状态 |
|---------|---------|------|------|
| Cause Anchor: run/route.ts 事务 | run/route.ts 使用 db.transaction + repeatable read + tx.select/insert | Unit | ⏳ |
| Cause Anchor: batch/route.ts 事务 | batch/route.ts 使用 db.transaction + repeatable read + tx.select/insert | Unit | ⏳ |
| Cause Anchor: resolve.ts tx 支持 | 导出 Tx 类型 + conn 参数 + 函数体用 conn | Unit | ⏳ |
| Boundary #1 | conn 默认值 db | Unit | ⏳ |
| Boundary #2 | ConfigError 定义 + throw + catch → 400 | Unit | ⏳ |
| Boundary #3 | inngest.send 在事务块之后 | Unit | ⏳ |
| Boundary #4 | resolvePublishedVersionId 未修改 | Unit | ⏳ |
| Blast Shield #1 | existingRunningBatch 在事务前 | Unit | ⏳ |
