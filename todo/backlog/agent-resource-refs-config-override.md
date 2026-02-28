---
priority: P3
---
# 为 agent_resource_refs 增加 config_override 字段

当前引用池资源只能 enabled/disabled，无法覆盖部分配置。未来如需 Agent 引用池资源时自定义描述、参数等，加 `config_override jsonb` 字段做合并覆盖。

> Anchor: `web/src/db/schema.ts`（`agentResourceRefs` 表定义）
