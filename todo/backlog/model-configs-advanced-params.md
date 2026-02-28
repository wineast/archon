---
priority: P3
---
# 为 model_configs 增加高级模型参数

当前只有 temperature，后续需要扩展 max_tokens / top_p 等高级参数。可加独立字段或用 `options jsonb` 统一存放。

> Anchor: `web/src/db/schema.ts`（`modelConfigs` 表定义）
