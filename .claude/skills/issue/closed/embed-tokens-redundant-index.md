# embedTokens token 字段冗余索引

## 问题描述

`embedTokens.token` 字段有 `.unique()` 约束（PostgreSQL 自动创建唯一索引），同时又手动声明了 `index("embed_tokens_token_idx").on(table.token)`，产生两个功能相同的索引。

## 涉及文件

- `web/src/db/schema.ts:1016` — `token: text("token").notNull().unique()`
- `web/src/db/schema.ts:1030` — `index("embed_tokens_token_idx").on(table.token)`

## 分析

UNIQUE 约束在 PostgreSQL 中自动创建一个 B-tree 唯一索引，手动再加一个普通索引完全冗余，只增加写入开销和存储占用。

## 修复方向

删除 `index("embed_tokens_token_idx").on(table.token)` 这一行。
