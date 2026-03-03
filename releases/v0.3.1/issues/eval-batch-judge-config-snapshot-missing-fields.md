---
priority: P0
status: merged
tags: [eval, batch, judge]
worktree: eval-batch-judge-config-snapshot-missing-fields
merged: true
---
# Eval Batch 模式 judgeConfigSnapshot 丢失 promptTemplate/turnPromptTemplate

## Symptom（看到了什么）
batch 模式下创建的 eval run，自定义 judge prompt template 被静默忽略，judge 评估退回默认模板。单次 run 模式正常。

## Trigger（怎么触发的）
在 judge agent 上配置了自定义 `promptTemplate` 和 `turnPromptTemplate`，通过 batch 模式发起多次重复评估。execute-case 读取 judgeConfigSnapshot 时这两个字段为 undefined，fallback 到默认模板。

## Locale（大概在哪）
- `web/src/app/api/eval/batch/route.ts`（第 158-161 行）—— per-run judgeConfigSnapshot 只有 name + dimensions
- 对比 `web/src/app/api/eval/run/route.ts`（第 129-134 行）—— 完整快照含 promptTemplate + turnPromptTemplate

## Hypothesis（猜是什么原因）
batch/route.ts 在创建 per-run 记录时复制了 batch 级别的 judgeConfigSnapshot（只有 name + dimensions），遗漏了 promptTemplate 和 turnPromptTemplate 两个字段。execute-case.ts:131-132 读到 undefined 后 fallback 为 null，renderJudgePrompt 使用默认模板。修复方向：batch 路由的 per-run judgeConfigSnapshot 补上这两个字段。

## Impact（不修会怎样）

所有使用 batch 模式进行评估的用户，只要自定义了 judge prompt template，评分结果都会**静默退回默认模板**——用户精心编写的评判提示词被完全忽略，但 UI 不会有任何报错或提示。这意味着 batch 评估的分数与单次 run 评估的分数不可比，用户可能基于错误的评分结果做出误判。绕行方案：改用单次 run 逐个跑，但这样就失去了 batch 的效率优势。
