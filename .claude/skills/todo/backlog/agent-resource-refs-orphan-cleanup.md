# agent_resource_refs 孤儿引用清理

resource_id 无 FK 约束（多态引用），池资源被删时引用记录不会自动清理。需在代码层删除池资源时顺带清理 refs，或跑定时任务扫描。
