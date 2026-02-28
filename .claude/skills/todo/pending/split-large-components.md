---
priority: P2
---
# 拆分大型组件（prompt-input / chat-page-content / results-panel）

prompt-input（1341 行）、chat-page-content（771 行）、results-panel（813 行）三个超大组件职责混合，需按关注点拆分。

> Anchor: `web/src/components/prompt-input.tsx`, `web/src/components/chat-page-content.tsx`, `web/src/components/eval/results-panel.tsx`
