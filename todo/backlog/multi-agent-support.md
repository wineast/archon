---
priority: P3
---
# 实现 Multi-Agent / Agent Team 架构支持

从 Agent-as-Tool 开始，在 tool 执行层加一种"调用另一个 Agent"的 handler，逐步演进到 Agent Team 编排。

> Anchor: `web/src/db/schema.ts`（`tools` 表定义 / tool handler 执行层）
