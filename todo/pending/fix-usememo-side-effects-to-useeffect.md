---
priority: P2
---
# 将 useMemo 中的副作用迁移到 useEffect

两处组件使用 `useMemo` 执行副作用（注册动态组件到全局 registry），违反 React 纯度契约，`useMemo` 不保证缓存稳定可能导致副作用重复执行。

> Anchor: `web/src/app/(nonlocale)/embed/[agentId]/page.tsx:255-301`、`web/src/components/chat-page-content.tsx:184-215`
