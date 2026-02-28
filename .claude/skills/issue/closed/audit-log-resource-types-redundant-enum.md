---
priority: P2
---
# auditLogResourceTypes 冗余枚举值

## Symptom（看到了什么）

`auditLogResourceTypes` 数组同时包含 `"eval_judge_config"` 和 `"judge_config"`。表名已从 `eval_judge_configs` 改为 `judge_configs`，旧值应清理。

## Trigger（怎么触发的）

审查 `web/src/db/schema.ts` 中的枚举定义时发现，表名重构后遗留了旧枚举值未清理。

## Locale（大概在哪）

- `web/src/db/schema.ts:1352` — `"eval_judge_config", "judge_config"` 并存

## Hypothesis（猜是什么原因）

表名从 `eval_judge_configs` 重命名为 `judge_configs` 时，只更新了表定义但遗漏了 `auditLogResourceTypes` 枚举数组中的旧值。

修复方向：
1. 检查 audit_logs 表中是否有 `resource_type = 'eval_judge_config'` 的记录
2. 如果有：UPDATE 为 `'judge_config'` 后删除旧值
3. 如果没有：直接从数组中移除 `"eval_judge_config"`
