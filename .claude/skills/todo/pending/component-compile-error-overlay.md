---
priority: P3
---
# 组件编译 console.error 触发 Next.js dev overlay

`compileComponentGraph` 的 try-catch 中 `console.error` 输出 SyntaxError 对象会触发 Next.js dev 模式的 error overlay。考虑改为 `console.warn` 或用其他方式避免 overlay 弹出。

涉及文件：`web/src/components/chat-page-content.tsx:194`
