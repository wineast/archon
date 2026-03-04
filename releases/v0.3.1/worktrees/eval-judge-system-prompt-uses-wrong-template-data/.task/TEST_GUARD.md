# 测试守护规约：Judge systemPrompt 使用 judge agent 自身的 templateData

> 生成时间：2026-03-03 21:20
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 关联修复：[FIX_REPORT.md](FIX_REPORT.md)
> 关联验证：[VERIFY_REPORT.md](VERIFY_REPORT.md)
> 分支：`dev-eval-judge-system-prompt-uses-wrong-template-data-20260303`

## 1. Invariant（不变量）

**Judge systemPrompt 必须使用 judge agent 自身的 templateData 渲染，不可使用被评估 agent 的 templateData。**

来源：DEFECT.md Delta 取反——"judge systemPrompt 使用被评估 agent 的 templateData" → "judge systemPrompt 必须使用 judge agent 自身的 templateData"

## 2. Trigger Scenario（触发场景）

### Given
- 被评估 agent（agentId="agent-1", chatVersionId="version-1"）
- Judge agent（judgeAgentId="judge-1", judgeVersionId="judge-version-1"）
- Judge systemPrompt 包含模板变量

### When
- 调用 executeCase

### Then
- renderTemplate 渲染 judge systemPrompt 时，第二个参数为 judge agent 的 templateData（非 eval agent 的）

**Level**: Unit
**来源**: DEFECT.md Path → 精简为 executeCase 单次调用

## 3. Cause Anchor（根因锚点）

### 故障机制
executeCase 只为被评估 agent 调用一次 gatherTemplateData，judge systemPrompt 渲染复用了被评估 agent 的数据

### 锚点断言
1. gatherTemplateData 被调用两次：第一次 (evalAgentId, evalVersionId)，第二次 (judgeAgentId, judgeVersionId)
2. renderTemplate 渲染 judge systemPrompt 时，接收的 templateData 是第二次 gather 的结果（judge agent 的数据）

**Level**: Unit
**来源**: FIX_REPORT.md Root Cause + Change

## 4. Boundary Set（边界集）

| # | 变体 | 来源 | Level |
|---|------|------|-------|
| 1 | judgeVersionId=null（旧 run 记录）：gatherTemplateData 收到 undefined 安全降级 | 验证报告 Boundary | Unit |
| 2 | judgeAgentId=null：gatherTemplateData 收到 undefined 安全降级 | Root Cause 推导 | Unit |
| 3 | per-turn judge（sequential 模式）同样使用 judge templateData | Root Cause 推导（两处渲染点） | Unit |

## 5. Blast Shield（防爆盾）

| # | 区域 | 断言 | 来源 | Level |
|---|------|------|------|-------|
| 1 | chat systemPrompt 渲染 | renderTemplate 渲染 chatSystemPrompt 时使用 eval agent 的 templateData | FIX_REPORT Blast Radius | Unit |
| 2 | templateData 资源释放 | finally 中 disposeTemplateData 对 eval 和 judge 两份 templateData 都调用 | FIX_REPORT Change | Unit |

## 6. Coverage Matrix（覆盖矩阵）

| 守护元素 | 测试用例 | 层级 | 状态 |
|---------|---------|------|------|
| Trigger Scenario | judge systemPrompt 使用 judge 自身的 templateData 渲染 | Unit | ⏳ |
| Cause Anchor | gatherTemplateData 分别为 eval 和 judge 调用 | Unit | ⏳ |
| Cause Anchor | renderTemplate 渲染 judge systemPrompt 接收 judge templateData | Unit | ⏳ |
| Boundary #1 | judgeVersionId=null 安全降级 | Unit | ⏳ |
| Boundary #2 | judgeAgentId=null 安全降级 | Unit | ⏳ |
| Boundary #3 | sequential 模式 per-turn judge 使用 judge templateData | Unit | ⏳ |
| Blast Shield #1 | chat systemPrompt 使用 eval templateData | Unit | ⏳ |
| Blast Shield #2 | 两份 templateData 都被 dispose | Unit | ⏳ |
