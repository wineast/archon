---
priority: P1
---
# 在关键路由添加 Next.js error.tsx 错误边界

当前整个应用仅有一个 `DynamicComponentErrorBoundary`，其他任何组件抛出未捕获异常都会导致白屏，需要在根布局和关键路由组添加 `error.tsx`。

> Anchor: `web/src/app/layout.tsx`、`web/src/app/[locale]/layout.tsx`
