---
priority: P3
---
# 实现 Multi-Agent / Agent Team 架构支持

从 Agent-as-Tool（层次1）开始，逐步演进到 Agent Team 编排（层次2）和动态编排（层次3）。第一步先实现 Agent-as-Tool，在 tool 执行层加一种"调用另一个 Agent"的 handler，改动最小、复用现有基础设施、可快速验证需求。

> Anchor: `web/src/db/schema.ts`（`tools` 表定义 / tool handler 执行层）
