---
priority: P3
---
# schema-display 用 React 元素替代 dangerouslySetInnerHTML

`schema-display.tsx:176` 用 `dangerouslySetInnerHTML` 做路径参数高亮（`{param}` 变彩色 span）。虽然当前 regex 受控，但可以用 React 元素动态构建来避免 innerHTML。

> Anchor: `web/src/components/ai-elements/schema-display.tsx:176`
