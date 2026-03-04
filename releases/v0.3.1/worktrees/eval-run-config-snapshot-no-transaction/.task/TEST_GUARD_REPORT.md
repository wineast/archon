# 测试守护报告：Eval Run/Batch 配置快照事务隔离

> 执行时间：2026-03-02 22:00
> 关联规约：[TEST_GUARD.md](TEST_GUARD.md)
> 分支：`dev-eval-run-config-snapshot-no-transaction-20260302`

## 1. 规约概要

### Invariant
Eval Run 和 Batch 创建时，配置快照的全部数据库查询和写入必须在同一个 Repeatable Read 事务中执行。

### 覆盖统计
| 元素 | 规约数 | 测试数 | 通过 | 失败 |
|------|--------|--------|------|------|
| Cause Anchor | 3 组 | 11 | 11 | 0 |
| Boundary Set | 4 | 6 | 6 | 0 |
| Blast Shield | 1 | 2 | 2 | 0 |

## 2. 测试结果

### 静态检查
- `make typecheck`：通过
- `make test`：通过（123 文件 / 1412 用例）

### 单元测试
| 文件 | 用例数 | 通过 | 失败 | 覆盖规约 |
|------|--------|------|------|----------|
| `web/src/app/api/eval/__tests__/config-snapshot-tx.guard.test.ts` | 19 | 19 | 0 | Cause Anchor（全部）、Boundary（全部）、Blast Shield（全部） |

### E2E 测试
不适用。此缺陷为代码结构级并发竞态，无法通过 UI 操作稳定复现。守护测试通过源码结构审计替代 E2E。

## 3. Coverage Matrix（覆盖矩阵）

| 守护元素 | 测试用例 | 文件 | 层级 | 结果 |
|---------|---------|------|------|------|
| Cause Anchor: run/route.ts 事务 | 使用 db.transaction 包裹配置查询 | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Cause Anchor: run/route.ts 事务 | 事务使用 repeatable read 隔离级别 | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Cause Anchor: run/route.ts 事务 | 事务内通过 tx 调用 resolveEditingVersionId | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Cause Anchor: run/route.ts 事务 | 事务内配置查询使用 tx.select | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Cause Anchor: run/route.ts 事务 | 事务内 insert 使用 tx.insert | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Cause Anchor: batch/route.ts 事务 | 使用 db.transaction 包裹配置查询 | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Cause Anchor: batch/route.ts 事务 | 事务使用 repeatable read 隔离级别 | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Cause Anchor: batch/route.ts 事务 | 事务内通过 tx 调用 resolveEditingVersionId | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Cause Anchor: batch/route.ts 事务 | 事务内配置查询使用 tx.select | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Cause Anchor: batch/route.ts 事务 | 事务内 batch + run insert 使用 tx.insert | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Cause Anchor: resolve.ts tx 支持 | 导出 Tx 类型 + conn 参数 + 函数体用 conn | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Boundary #1 | conn 参数有默认值 db | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Boundary #2 | resolvePublishedVersionId 未修改 | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Boundary #3 | ConfigError 定义 + throw + catch → 400 | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Boundary #3 | batch/route.ts 同样使用 ConfigError 模式 | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Boundary #4 | run/route.ts inngest.send 在事务块之后 | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Boundary #4 | batch/route.ts inngest.send 在事务块之后 | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Blast Shield #1 | run/route.ts existingRunningBatch 在事务前 | config-snapshot-tx.guard.test.ts | Unit | 通过 |
| Blast Shield #1 | batch/route.ts existingRunning 在事务前 | config-snapshot-tx.guard.test.ts | Unit | 通过 |

## 4. Verdict（裁定）

### 判决
守护就绪

### 证据摘要
- **Cause Anchor**：11 条源码结构断言全部通过，确认 run/batch 路由事务包裹 + repeatable read + tx 调用
- **Boundary Set**：6 条边界断言全部通过，覆盖向后兼容、ConfigError 处理、Inngest 时序、未修改函数
- **Blast Shield**：2 条防爆断言全部通过，确认并发检查位于事务外（已知局限位置锁定）

### 未覆盖项
- **E2E 层 Trigger Scenario**：此缺陷为代码结构级并发竞态，无法通过 UI 操作稳定复现。已用源码结构审计替代 E2E，覆盖了所有 Cause Anchor 断言。双层防护中 E2E 层缺失但根因层已完整覆盖。

### Traceability（追溯）
```
origin: DEFECT.md
fixed_by: FIX_REPORT.md
verified_by: VERIFY_REPORT.md
guarded_by: TEST_GUARD.md + 本报告
```

### 新增测试文件
| 文件 | 类型 | 用例数 |
|------|------|--------|
| `web/src/app/api/eval/__tests__/config-snapshot-tx.guard.test.ts` | Unit | 19 |

## 过程备注

- [确认] 此缺陷为并发竞态问题，无法用 E2E 测试复现——E2E 需要精确控制两个并发事务的交叉时序，不可行。源码结构审计是此类问题的最佳守护方式
- [确认] 参考了同项目已有的守护测试模式（`execute-case-versionid.guard.test.ts`），采用 `readFileSync` 源码分析方法
- [确认] 19 个测试用例覆盖了规约的全部 Cause Anchor、Boundary Set、Blast Shield 条目
