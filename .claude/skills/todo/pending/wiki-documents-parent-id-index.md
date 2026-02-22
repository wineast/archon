# wiki_documents 给 parent_id 加索引

查某文档的子文档列表需走 parent_id，当前无索引。数据量增大后需加 index("wiki_documents_parent_id_idx").on(parentId)。
