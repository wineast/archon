---
priority: P2
---
# Build 页面面板组件改为动态导入按需加载

Build 页面顶部静态导入全部 22 个面板组件但同时只显示 1 个，Monaco Editor 和 React Flow 等重型依赖也应延迟加载以减少初始 bundle 体积。

> Anchor: `web/src/app/[locale]/[orgSlug]/[agentSlug]/build/page.tsx:42-84`
