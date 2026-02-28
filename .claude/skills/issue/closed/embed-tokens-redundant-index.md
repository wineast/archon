---
priority: P3
---
# embedTokens token 字段冗余索引

## Symptom（看到了什么）

`embedTokens.token` 字段有 `.unique()` 约束（PostgreSQL 自动创建唯一索引），同时又手动声明了 `index("embed_tokens_token_idx").on(table.token)`，产生两个功能相同的索引。

## Trigger（怎么触发的）

审查 `web/src/db/schema.ts` 中 embedTokens 表定义时发现重复索引。

## Locale（大概在哪）

- `web/src/db/schema.ts:1016` — `token: text("token").notNull().unique()`
- `web/src/db/schema.ts:1030` — `index("embed_tokens_token_idx").on(table.token)`

## Hypothesis（猜是什么原因）

UNIQUE 约束在 PostgreSQL 中自动创建一个 B-tree 唯一索引，手动再加一个普通索引完全冗余，只增加写入开销和存储占用。可能是定义 schema 时对 `.unique()` 自动创建索引的机制不了解，手动补了一个。

修复方向：删除 `index("embed_tokens_token_idx").on(table.token)` 这一行。
