# Eval Run 执行时 versionId 实时解析导致配置漂移

## Symptom（看到了什么）
eval run 创建时快照了当时版本的 systemPrompt，但 case 执行时 tools、templateData（datasets/wiki/functions/schemas）可能来自不同版本，导致 systemPrompt 中引用的工具名或 Liquid 变量与实际提供的不匹配。

## Trigger（怎么触发的）
1. 发起 eval run，editingVersionId 指向 V1，快照 V1 的 systemPrompt
2. eval 运行期间用户发布新版本，editingVersionId 变为 V2
3. 后续 case 用 V2 的 tools/templates + V1 的 systemPrompt 执行

## Locale（大概在哪）
- `web/src/lib/eval/execute-case.ts`（第 136-137 行）—— `resolveEditingVersionId` 实时查询
- `web/src/app/api/eval/run/route.ts` —— 未快照 versionId

## Hypothesis（猜是什么原因）
run 创建时只快照了 modelConfig（systemPrompt/temperature/modelId），但没有快照 `versionId`。case 执行时 `resolveEditingVersionId(evalAgentId)` 是实时查询，如果用户在 eval 运行期间发布新版本或切换编辑版本，后续 case 会拿到新版本的 tools 和 templateData，与已快照的旧版 systemPrompt 不一致。修复方向：run 创建时快照 versionId，case 执行时使用快照值。
