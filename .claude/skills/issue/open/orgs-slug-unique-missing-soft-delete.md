# orgs.slug 唯一约束缺少 soft-delete 条件

## 问题描述

`orgs` 表的 `slug` 字段唯一约束未加 `deleted_at IS NULL` 部分索引条件，导致已软删除的 org 仍占用 slug，新 org 无法复用相同 slug。

## 涉及文件

- `web/src/db/schema.ts` — orgs 表定义，uniqueIndex("orgs_slug_idx") 缺少 `.where(sql\`deleted_at IS NULL\`)`

## 分析

项目中其他带 soft-delete 的表（如 agents）已统一采用 `.where(sql\`deleted_at IS NULL\`)` 部分唯一索引模式，orgs.slug 是遗漏。当前不影响功能（org 软删除场景少），但与整体设计不一致。

## 修复方向

将 `uniqueIndex("orgs_slug_idx").on(table.slug)` 改为 `uniqueIndex("orgs_slug_idx").on(table.slug).where(sql\`deleted_at IS NULL\`)`，然后 `make db-push`。
