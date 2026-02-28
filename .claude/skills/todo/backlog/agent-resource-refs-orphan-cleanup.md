---
priority: P3
---
# 清理 agent_resource_refs 中的孤儿引用

resource_id 无 FK 约束（多态引用），池资源被删时引用记录不会自动清理。需在代码层删除池资源时顺带清理 refs，或跑定时任务扫描。

> Anchor: `web/src/db/schema.ts`（`agentResourceRefs` 表定义）
