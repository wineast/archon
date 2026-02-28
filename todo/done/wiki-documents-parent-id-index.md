---
priority: P2
---
# 为 wiki_documents 的 parent_id 添加数据库索引

查某文档的子文档列表需走 parent_id 查询，当前无索引。数据量增大后需加 `index("wiki_documents_parent_id_idx").on(parentId)` 提升查询性能。

> Anchor: `web/src/db/schema.ts` (wiki_documents 表)
