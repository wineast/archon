# 删除废弃的 ComponentPreviewPanel 组件

- **优先级**: low
- **发现日期**: 2026-02-19
- **工作区**: cleanup-dead-code

## 描述

`ComponentPreviewPanel` 组件已不再使用——组件预览功能现在在广场页面实现，不再需要这个独立的预览面板。该组件仅在 Storybook stories 中被引用，业务代码无任何引用。

## 分析

需要删除的文件：
- `web/src/components/tools/component-preview-panel.tsx` — 组件本体
- `web/src/components/tools/__stories__/component-preview-panel.stories.tsx` — 对应 story
- `web/src/components/editors/__stories__/jsx-editor-preview.stories.tsx` — 也引用了该组件，需检查是否整个 story 废弃或只需移除引用

## 修复方向

1. 删除组件文件和对应 stories
2. 检查 `jsx-editor-preview.stories.tsx` 是否还有独立价值，如果只是为了展示 ComponentPreviewPanel 则一并删除
