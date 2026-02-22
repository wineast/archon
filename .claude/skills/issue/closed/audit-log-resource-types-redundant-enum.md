# auditLogResourceTypes 冗余枚举值

## 问题描述

`auditLogResourceTypes` 数组同时包含 `"eval_judge_config"` 和 `"judge_config"`。表名已从 `eval_judge_configs` 改为 `judge_configs`，旧值应清理。

## 涉及文件

- `web/src/db/schema.ts:1352` — `"eval_judge_config", "judge_config"` 并存

## 分析

表名重构后遗留了旧枚举值。如果数据库中已有 `"eval_judge_config"` 的审计记录，需要数据迁移；如果没有历史数据，直接删除即可。

## 修复方向

1. 检查 audit_logs 表中是否有 `resource_type = 'eval_judge_config'` 的记录
2. 如果有：UPDATE 为 `'judge_config'` 后删除旧值
3. 如果没有：直接从数组中移除 `"eval_judge_config"`
