---
priority: P2
---
# judgeConfigs 索引名前缀与表名不一致

## Symptom（看到了什么）

`judge_configs` 表的索引名仍使用旧前缀 `eval_judge_configs_`（如 `eval_judge_configs_org_id_idx`），与表名 `judge_configs` 不匹配。

## Trigger（怎么触发的）

审查 schema 中 judgeConfigs 表定义时，发现索引名前缀与当前表名不一致。

## Locale（大概在哪）

- `web/src/db/schema.ts` — judgeConfigs 表定义中的 index/uniqueIndex 名称

## Hypothesis（猜是什么原因）

该表从 `eval_judge_configs` 改名为 `judge_configs`，但索引名未同步更新。纯命名一致性问题，不影响功能和查询性能，但在数据库工具中查看时会造成混淆。

修复方向：将所有 `eval_judge_configs_` 前缀的索引名统一改为 `judge_configs_`，然后 `make db-push`。
