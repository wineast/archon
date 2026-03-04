---
priority: P0
status: merged
tags: [eval, judge, template]
worktree: eval-judge-system-prompt-uses-wrong-template-data
merged: true
---
# Judge systemPrompt 渲染使用被评估 agent 的 templateData，而非 judge agent 自身的

## Symptom（看到了什么）
judge agent 的 systemPrompt 中 Liquid 变量被解析为被评估 agent 的 datasets/wiki/tools 数据，而非 judge agent 自身的数据。如果 judge systemPrompt 引用了只存在于 judge agent 的变量（如 judge 专用的评分标准数据集），会渲染为空。

## Trigger（怎么触发的）
配置 judge agent 的 systemPrompt 引用 judge agent 自身的数据集变量（如 `{{ scoring_criteria }}`），该数据集只在 judge agent 中存在。运行 eval 后发现该变量渲染为空，因为 templateData 来自被评估 agent。

## Locale（大概在哪）
- `web/src/lib/eval/execute-case.ts`（第 332-336 行、第 382-386 行）—— judge generateText 的 system 参数
- `web/src/lib/eval/execute-case.ts`（第 137 行）—— templateData 只针对 evalAgentId 收集

## Hypothesis（猜是什么原因）
executeCase 只 gather 了被评估 agent 的 templateData（第 136-137 行），没有为 judge agent 单独 gather templateData。judge systemPrompt 渲染时复用了被评估 agent 的 templateData，导致 judge 独有的变量无法解析。如果是有意让 judge 访问被评估 agent 的上下文，也应该额外 gather judge 的 templateData 做合并；如果无意，则应该用 judge 自身的 templateData 渲染 judge systemPrompt。

## Impact（不修会怎样）

所有在 judge agent 的 systemPrompt 中使用 judge 自身数据集变量（如评分标准、评判维度说明等）的用户都会受影响——这些变量会被渲染为空，导致 judge 在评分时丢失关键上下文，评分结果不准确甚至完全偏离预期。目前没有绕行方案：用户无法通过把评分标准数据集挂到被评估 agent 上来规避，因为那会污染被评估 agent 的提示词上下文，违背 judge 与被评估 agent 职责分离的设计初衷。
