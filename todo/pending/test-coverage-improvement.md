---
priority: P2
---
# 提升单元测试覆盖率

lib 层工具函数和 hooks 覆盖极少，核心组件（chat-page-content、results-panel 等）无测试，优先补 lib 层 → 核心 hooks → 关键组件。

> Anchor: `web/src/__tests__/`, `web/vitest.config.ts`
