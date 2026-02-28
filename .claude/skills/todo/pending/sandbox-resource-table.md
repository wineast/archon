---
priority: P2
---
# 新建沙箱资源表（sandboxes）

组织级独立表，不进 RESOURCE_TYPES，不走 agentResourceRefs。

字段设计：
- 标识：orgId, key, name, description
- 运行时：runtime (light/deno/e2b/docker), image
- 资源限制：memoryLimitMb, timeoutMs, maxStackSizeMb
- 依赖：dependencies (JSONB), initScript
- 能力授权：permissions (JSONB, allow-list: network/env/fs)

后续再设计与 Agent/Tool/Function 的关联方式。
