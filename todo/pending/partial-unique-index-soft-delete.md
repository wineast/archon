# 软删除表的唯一约束改为 partial unique index

所有有 `deletedAt` 的表的 `unique(agentId, key)` 约束改为 `WHERE deleted_at IS NULL`，避免软删除记录阻止创建同 key 的新记录。

涉及表：functions、datasets、wiki_documents、schemas、tools、skills、components、object_types、object_relations、eval_cases、eval_judge_configs、mcp_servers。
