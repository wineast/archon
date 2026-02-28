---
priority: P3
---
# chat-page-content 用 Map 替代线性查找

`chat-page-content.tsx` 中 `componentsList.find()` 和 `toolsList.some()` 在每条消息渲染时做线性查找。消息量大时性能下降。用 `useMemo` 构建 Map 做 O(1) 查找。

> Anchor: `web/src/components/chat-page-content.tsx:208,278`
