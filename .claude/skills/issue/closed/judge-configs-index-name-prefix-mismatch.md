# judgeConfigs 索引名前缀与表名不一致

## 问题描述

`judge_configs` 表的索引名仍使用旧前缀 `eval_judge_configs_`（如 `eval_judge_configs_org_id_idx`），与表名 `judge_configs` 不匹配。

## 涉及文件

- `web/src/db/schema.ts` — judgeConfigs 表定义中的 index/uniqueIndex 名称

## 分析

该表从 `eval_judge_configs` 改名为 `judge_configs`，但索引名未同步更新。纯装饰性问题，不影响功能和查询性能，但在数据库工具中查看时会造成混淆。

## 修复方向

将所有 `eval_judge_configs_` 前缀的索引名统一改为 `judge_configs_`，然后 `make db-push`。
