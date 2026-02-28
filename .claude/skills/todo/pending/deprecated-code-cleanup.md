---
priority: P3
---
# 清理已弃用的代码（deprecated API 和类型）

代码中有 6 处 `@deprecated` 标记，部分已长期未使用：
- `EMBEDDING_DIMENSIONS` 常量 → 应全部迁移到 `getEmbeddingDimensions()`
- `WIKI_API_KEY` 常量 → 应全部迁移到 `wikiApiKey(agentId)`
- `SchemaPropertyType` / `SchemaProperty` 类型 → 仅迁移脚本使用，确认无引用后删除
- `useEvalRun` 别名 → 应全部迁移到 `useEvalBatch`
- `migrate-enumref.ts` 脚本 → 确认迁移完成后删除

> Anchor: 搜索 `@deprecated` 注释
