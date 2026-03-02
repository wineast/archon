# 测试守护规约：Eval run case 执行使用快照 versionId

> 生成时间：2026-03-02 12:30
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 关联修复：[FIX_REPORT.md](FIX_REPORT.md)
> 关联验证：[VERIFY_REPORT.md](VERIFY_REPORT.md)
> 分支：`dev-eval-run-versionid-drift-20260302`

## 1. Invariant（不变量）

Eval run 的所有 case 必须使用 run 创建时快照的 versionId 加载 tools 和 templateData，不可实时查询当前编辑版本。

来源：DEFECT.md Delta 取反

## 2. Trigger Scenario（触发场景）

### Given
一个 run 记录，`chatVersionId` 为特定快照值（如 "snapshot-v1"）

### When
`executeCase` 被调用执行 case

### Then
- `gatherTemplateData` 接收 `"snapshot-v1"` 作为 versionId 参数
- tools 查询使用 `"snapshot-v1"` 作为 where 条件
- 不调用 `resolveEditingVersionId`

**Level**: Unit
**来源**: DEFECT.md Path → 精简为代码级触发（E2E 复现竞态条件成本过高）

## 3. Cause Anchor（根因锚点）

### 故障机制
`executeCase` 调用 `resolveEditingVersionId(agentId)` 实时查询可变字段 `agents.editingVersionId`，run 创建与 case 执行之间的时间窗口导致版本漂移。

### 锚点断言
1. `execute-case.ts` 源码不包含字符串 `resolveEditingVersionId`（import 已移除）
2. `gatherTemplateData` 接收的 versionId 严格等于 `run.chatVersionId`
3. 不同 run 使用各自快照的 chatVersionId（互不干扰）

**Level**: Unit
**来源**: FIX_REPORT.md Root Cause + Change

## 4. Boundary Set（边界集）

| # | 变体 | 来源 | Level |
|---|------|------|-------|
| 1 | chatVersionId = null（旧 run 兼容） | 验证报告 Boundary #1 | Unit |
| 2 | chatVersionId = null 时不查询 tools | 验证报告 Boundary #1 | Unit |
| 3 | chatVersionId = null 时不报错 | Root Cause 推导 | Unit |

## 5. Blast Shield（防爆盾）

| # | 区域 | 断言 | 来源 | Level |
|---|------|------|------|-------|
| 1 | single 模式 | 使用快照 versionId 后正常执行 | FIX_REPORT Blast Radius | Unit |
| 2 | injected 模式 | 使用快照 versionId 后正常执行 | FIX_REPORT Blast Radius | Unit |
| 3 | sequential 模式 | 使用快照 versionId 后正常执行 | FIX_REPORT Blast Radius | Unit |

## 6. Coverage Matrix（覆盖矩阵）

| 守护元素 | 测试用例 | 层级 | 状态 |
|---------|---------|------|------|
| Cause Anchor #1 | execute-case.ts 不 import resolveEditingVersionId | Unit | ⏳ |
| Cause Anchor #2 | gatherTemplateData 接收 run.chatVersionId | Unit | ⏳ |
| Cause Anchor #3 | 不同 run 使用各自快照的 chatVersionId | Unit | ⏳ |
| Boundary #1 | chatVersionId = null 时 gatherTemplateData 收到 undefined | Unit | ⏳ |
| Boundary #2 | chatVersionId = null 时不查询 tools | Unit | ⏳ |
| Boundary #3 | chatVersionId = null 时不报错 | Unit | ⏳ |
| Blast Shield #1 | single 模式正常执行 | Unit | ⏳ |
| Blast Shield #2 | injected 模式正常执行 | Unit | ⏳ |
| Blast Shield #3 | sequential 模式正常执行 | Unit | ⏳ |
