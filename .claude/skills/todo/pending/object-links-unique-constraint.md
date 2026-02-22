# object_links 增加唯一约束防重复关联

当前 `(relation_id, source_id, target_id)` 无唯一约束，同一对实例可建多条相同关系的 link。建议加 `UNIQUE(relation_id, source_id, target_id)`。
