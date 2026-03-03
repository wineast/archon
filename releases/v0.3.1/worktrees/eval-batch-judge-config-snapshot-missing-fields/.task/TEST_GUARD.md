# 测试守护规约：Batch 模式 judgeConfigSnapshot 必须包含 promptTemplate + turnPromptTemplate

> 生成时间：2026-03-02
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 关联修复：[FIX_REPORT.md](FIX_REPORT.md)
> 关联验证：[VERIFY_REPORT.md](VERIFY_REPORT.md)
> 分支：`dev-eval-batch-judge-config-snapshot-missing-fields-20260302`

## 1. Invariant（不变量）

**Batch 模式创建的 eval batch 记录和 per-run 记录的 `judgeConfigSnapshot` 必须包含 `name`、`dimensions`、`promptTemplate`、`turnPromptTemplate` 全部四个字段，与单次 run 模式一致。**

来源：DEFECT.md Delta 取反

## 2. Trigger Scenario（触发场景）

### Given
- judge config 配置了自定义 `promptTemplate` 和 `turnPromptTemplate`

### When
- 通过 batch API 创建 eval batch（`POST /api/eval/batch`）

### Then
- batch 记录的 `judgeConfigSnapshot` 包含 `promptTemplate` 和 `turnPromptTemplate`
- per-run 记录的 `judgeConfigSnapshot` 包含 `promptTemplate` 和 `turnPromptTemplate`

**Level**: Unit
**来源**: DEFECT.md Path → 精简（纯数据透传，无 UI 行为，Unit 级测试最精确）

## 3. Cause Anchor（根因锚点）

### 故障机制
`batch/route.ts` 手动构造 `judgeConfigSnapshot` 对象时只复制了 `name` + `dimensions`，遗漏了 `promptTemplate` + `turnPromptTemplate`。

### 锚点断言
- batch 级 `judgeConfigSnapshot` 的 `promptTemplate` 字段等于 `judgeConfig.promptTemplate`
- batch 级 `judgeConfigSnapshot` 的 `turnPromptTemplate` 字段等于 `judgeConfig.turnPromptTemplate`
- per-run 级同上

**Level**: Unit
**来源**: FIX_REPORT.md Root Cause + Change

## 4. Boundary Set（边界集）

| # | 变体 | 来源 | Level |
|---|------|------|-------|
| 1 | 两个模板字段均为 null（用户未配置） | 验证报告 Boundary | Unit |
| 2 | 仅 promptTemplate 非 null（部分配置） | Root Cause 推导 | Unit |
| 3 | 两个模板字段均非 null（完整配置） | Trigger Scenario 覆盖 | Unit |

## 5. Blast Shield（防爆盾）

| # | 区域 | 断言 | 来源 | Level |
|---|------|------|------|-------|
| 1 | batch 与 per-run 一致性 | batch 级和 per-run 级快照包含相同字段集 | FIX_REPORT Blast Radius | Unit |

## 6. Coverage Matrix（覆盖矩阵）

| 守护元素 | 测试用例 | 层级 | 状态 |
|---------|---------|------|------|
| Cause Anchor | batch 级快照包含 promptTemplate 和 turnPromptTemplate | Unit | ✅ |
| Cause Anchor | per-run 级快照包含 promptTemplate 和 turnPromptTemplate | Unit | ✅ |
| Boundary #1 | 两个模板字段均为 null 时正确传递 | Unit | ✅ |
| Boundary #2 | 仅 promptTemplate 非 null 时正确传递 | Unit | ✅ |
| Blast Shield #1 | batch 级和 per-run 级快照包含相同字段集 | Unit | ✅ |
