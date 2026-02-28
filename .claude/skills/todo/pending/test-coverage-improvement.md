---
priority: P2
---
# 提升单元测试覆盖率（当前 ~12%）

817 个源文件只有 101 个测试文件（12.4%）。关键未覆盖区域：
- `web/src/lib/` 下的工具函数和 hooks 覆盖极少
- `chat-page-content.tsx`、`results-panel.tsx` 等核心组件无测试
- `component-playground.tsx`、`component-test-cases-panel.tsx` 无测试

优先补：lib 层工具函数 → 核心 hooks → 关键组件。

> Anchor: `web/src/__tests__/`, `web/vitest.config.ts`
