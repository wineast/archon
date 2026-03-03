# 测试守护报告：Batch 模式 judgeConfigSnapshot 必须包含 promptTemplate + turnPromptTemplate

> 执行时间：2026-03-02
> 关联规约：[TEST_GUARD.md](TEST_GUARD.md)
> 分支：`dev-eval-batch-judge-config-snapshot-missing-fields-20260302`

## 1. 规约概要

### Invariant
Batch 模式创建的 eval batch/run 记录的 `judgeConfigSnapshot` 必须包含 `promptTemplate` 和 `turnPromptTemplate` 字段。

### 覆盖统计
| 元素 | 规约数 | 测试数 | 通过 | 失败 |
|------|--------|--------|------|------|
| Cause Anchor | 2 | 2 | 2 | 0 |
| Boundary Set | 2 | 2 | 2 | 0 |
| Blast Shield | 1 | 1 | 1 | 0 |

## 2. 测试结果

### 静态检查
- `make typecheck`：通过
- `make test`：123 passed, 1 failed（`session-history.test.tsx` flaky，单独运行通过，与本次修改无关）

### 单元测试
| 文件 | 用例数 | 通过 | 失败 | 覆盖规约 |
|------|--------|------|------|----------|
| `src/app/api/eval/batch/__tests__/batch-judge-snapshot.guard.test.ts` | 5 | 5 | 0 | Cause Anchor ×2, Boundary ×2, Blast Shield ×1 |
| `src/app/api/eval/batch/__tests__/create-batch.test.ts` | 4 | 4 | 0 | 基础功能覆盖（补充） |

## 3. Coverage Matrix（覆盖矩阵）

| 守护元素 | 测试用例 | 文件 | 层级 | 结果 |
|---------|---------|------|------|------|
| Cause Anchor | batch 级快照包含 promptTemplate 和 turnPromptTemplate | `batch-judge-snapshot.guard.test.ts` | Unit | ✅ |
| Cause Anchor | per-run 级快照包含 promptTemplate 和 turnPromptTemplate | `batch-judge-snapshot.guard.test.ts` | Unit | ✅ |
| Boundary #1 | 两个模板字段均为 null 时正确传递 | `batch-judge-snapshot.guard.test.ts` | Unit | ✅ |
| Boundary #2 | 仅 promptTemplate 非 null 时正确传递 | `batch-judge-snapshot.guard.test.ts` | Unit | ✅ |
| Blast Shield #1 | batch 级和 per-run 级快照包含相同字段集 | `batch-judge-snapshot.guard.test.ts` | Unit | ✅ |

## 4. Verdict（裁定）

### 判决
✅ 守护就绪

### 证据摘要
- **Cause Anchor**：2/2 通过——batch 级和 per-run 级快照均正确包含 promptTemplate + turnPromptTemplate
- **Boundary Set**：2/2 通过——null 值和部分配置均正确传递
- **Blast Shield**：1/1 通过——batch 级和 per-run 级字段集一致

### 未覆盖项
无。E2E 层面未新增测试——此缺陷为纯后端数据透传问题，Unit 级测试直接断言快照内容比 E2E 更精确。E2E 无法直接观察 DB 快照字段是否存在。

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
| `web/src/app/api/eval/batch/__tests__/batch-judge-snapshot.guard.test.ts` | Unit (Guard) | 5 |
| `web/src/app/api/eval/batch/__tests__/create-batch.test.ts` | Unit | 4 |

## 过程备注

[确认] `session-history.test.tsx` 并行执行时偶发失败，单独运行通过，是已知 flaky test，与本次修改无关。
