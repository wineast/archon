---
priority: P1
---
# 应用缺少 Error Boundary 导致组件错误白屏崩溃

## Symptom（看到了什么）
整个应用没有任何 `error.tsx` 或 `global-error.tsx` 文件，唯一的 Error Boundary 是 `DynamicComponentErrorBoundary`（仅包裹动态渲染的工具 UI 组件）。任何一个组件渲染错误会导致整个 React 树崩溃，用户看到白屏。

## Trigger（怎么触发的）
聊天页面渲染包含错误的动态组件或工具输出、Build 页面某个面板报错、Eval 页面数据异常。

## Locale（大概在哪）
`web/src/app/layout.tsx`、`web/src/app/[locale]/layout.tsx`（缺少 error.tsx）、`web/src/components/chat-page-content.tsx`、`web/src/components/build-chat/build-chat-panel.tsx`

## Hypothesis（猜是什么原因）
Next.js App Router 通过 `error.tsx` 文件提供内置 Error Boundary 支持。需要在根布局、locale 布局、以及关键路由组（chat、build、eval）添加 error.tsx 文件。
