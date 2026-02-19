# 组件 AI 编辑器左侧代码无语法高亮

- **类型**: bug
- **优先级**: medium
- **发现日期**: 2026-02-19
- **工作区**: ui-bug-fixes

## 描述

组件的 AI 辅助编辑对话框中，左侧 Diff 面板的 JSX 代码没有语法高亮，显示为纯文本。见对话中截图。

## 分析

- 对话框组件：`web/src/components/components/jsx-assist-dialog.tsx`
- 使用了 CodeMirror 的 `unifiedMergeView` 和 `@codemirror/lang-javascript` 扩展
- 可能是 JavaScript 语法扩展未正确加载到 merge view，或缺少对应的 highlight 主题

## 修复方向

- 检查 CodeMirror EditorState 初始化时是否正确包含了 `javascript()` 语法扩展和 highlight 主题
- 确认 `unifiedMergeView` 配置中语法扩展生效
