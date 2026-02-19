# 函数代码编辑器缺少 AI 辅助编辑功能

- **类型**: feature
- **优先级**: medium
- **发现日期**: 2026-02-19
- **功能树**: 函数 AI 辅助编辑
- **工作区**: function-ai-edit

## 描述

函数（Functions）的 Code (JavaScript) 编辑器没有 AI 辅助编辑功能。组件编辑器已有类似的 AI Assist 对话框（`jsx-assist-dialog.tsx`），但函数编辑器缺失此功能。见对话中截图。

## 分析

- 组件 AI 编辑：`web/src/components/components/jsx-assist-dialog.tsx` — 使用 CodeMirror merge view + AI chat
- 函数编辑：`web/src/components/functions/function-form.tsx` — 有 CodeMirror 代码编辑器，但无 AI Assist 入口
- 需要为函数代码编辑器添加类似组件的 AI 辅助编辑能力

## 验收标准

- 函数代码编辑器有 AI 辅助编辑入口按钮
- 点击后弹出对话框，左侧 diff 视图、右侧 AI 对话
- AI 能理解函数上下文（参数、返回值定义）并修改代码
