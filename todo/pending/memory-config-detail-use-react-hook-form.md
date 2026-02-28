---
priority: P2
---
# MemoryConfigDetail 改用 react-hook-form 重构

`MemoryConfigDetail` 使用 9 个独立 `useState` 而非 react-hook-form，违反项目约定，每个字段变化导致整个 366 行组件重渲染。

> Anchor: `web/src/components/memory/memory-config-detail.tsx:42-54`
