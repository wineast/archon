---
priority: P3
---
# 修复复制按钮组件 setTimeout 未清除的内存泄漏

5 个复制按钮组件使用 `setTimeout` 但组件卸载时未清除 timer，可能对已卸载组件 setState 导致 React 警告和内存泄漏。

> Anchor: `web/src/components/embed-tokens/embed-code-dialog.tsx:27`、`web/src/components/ui/key-field.tsx:19`
