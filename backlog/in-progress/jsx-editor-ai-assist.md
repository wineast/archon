# 组件 JSX 编辑器缺少 AI 编辑功能

- **类型**: feature
- **优先级**: medium
- **发现日期**: 2026-02-19
- **工作区**: component-editor-enhance

## 描述

系统提示词编辑器已有"AI 编辑"功能（`PromptAssistDialog`），但组件的 JSX 编辑器没有。应为 JSX 编辑器也加上类似的 AI 辅助编辑能力，让用户可以通过对话式交互修改组件代码。

## 分析

- 系统提示词的 AI 编辑实现：`web/src/components/model-config/prompt-assist-dialog.tsx`，在 `model-config-detail.tsx:206-214` 调用
- 组件 JSX 编辑器：`web/src/components/components/component-form.tsx` 中的 `JsEditor`
- 目前 JSX 编辑器无任何 AI 辅助入口

## 修复方向

参考 `PromptAssistDialog` 的模式，为 JSX 编辑器增加 AI 编辑对话框，支持用自然语言描述来生成/修改组件代码。
