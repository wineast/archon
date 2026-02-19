# 删除组件表单中的两层闭包说明文字

- **优先级**: low
- **发现日期**: 2026-02-19
- **工作区**: component-editor-enhance

## 描述

`component-form.tsx` 中 JSX 编辑器下方有两行说明文字（"两层闭包..."、"外层参数..."），这些说明不需要，应删除。

## 分析

- `web/src/components/components/component-form.tsx:115-120` — 两个 `<p>` 标签

## 修复方向

删除这两行 `<p>` 元素。
