# 组件编写指南对话框内容超出右侧边界

- **类型**: bug
- **优先级**: medium
- **发现日期**: 2026-02-19
- **工作区**: ui-bug-fixes

## 描述

组件编写指南对话框（ComponentHelpDialog）中，Markdown 渲染的内容（代码块、表格等）超出对话框右侧边界，没有被正确约束在容器内。见对话中截图。

## 分析

- 对话框组件：`web/src/components/components/component-help-dialog.tsx`
- DialogContent 设置了 `max-w-3xl`，内部 prose 容器设置了 `max-w-none`
- 代码块（`<pre>`）和表格在内容较宽时会撑破容器，需要添加 `overflow-x-auto` 或在 prose 样式中约束宽度

## 修复方向

- 给 prose 容器或 ScrollArea 添加 `overflow-x: hidden` 或 `overflow-x: auto`
- 代码块添加 `overflow-wrap: break-word` 或 `overflow-x: auto`
