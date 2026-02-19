# 组件编辑器增加帮助文档按钮

- **优先级**: medium
- **发现日期**: 2026-02-19

## 描述

组件 JSX 编辑器旁边需要一个帮助按钮，点击后弹出帮助文档（MD 格式渲染），说明组件的编写规范：

- 两层闭包结构说明
- 第一层（外层）注入了哪些依赖（React、hooks、UI 组件、自定义组件等）
- 第二层（内层）props 有哪些字段（tool、state、isLoading、isComplete、isError 等），每个字段的类型和含义
- tool 对象展开后有哪些可用字段及说明
- 简单示例代码

## 分析

- 组件编辑器位置：`web/src/components/components/component-form.tsx`
- 帮助内容需要整理为一份 MD 文档
- UI 上可以用一个 `HelpCircle` 图标按钮，点击后弹出 Dialog/Sheet 展示 Markdown 渲染内容
- 两层闭包的注入内容需要查看 `web/src/tool-ui/` 下的运行时代码确认完整的注入列表

## 修复方向

1. 在 `guide/` 下创建组件编写帮助文档（如 `guide/component-authoring.md`）
2. 在 JSX 编辑器旁加帮助按钮，点击弹出渲染后的 MD 内容
