---
priority: P2
---
# 拆分大型组件（prompt-input / chat-page-content / results-panel）

三个超大组件亟需拆分：
- `prompt-input.tsx`（1341 行）：剪贴板、文件上传、模板渲染、附件管理混合
- `chat-page-content.tsx`（771 行）：会话管理、chat transport、工具执行、组件注册混合
- `results-panel.tsx`（813 行）：batch 管理、case 过滤、结果渲染、进度追踪混合

> Anchor: `web/src/components/prompt-input.tsx`, `web/src/components/chat-page-content.tsx`, `web/src/components/eval/results-panel.tsx`
