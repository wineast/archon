---
priority: P1
---
# Monaco 编辑器接入 archon:* 动态类型补全

`archon-types.ts` 中已定义类型声明生成函数，但没有任何 JsEditor 调用方传入 `moduleDeclarations` prop，需要在函数/工具/组件编辑器中根据当前 Agent 资源列表动态注入。

> Anchor: `web/src/components/js-editor/archon-types.ts`, `web/src/components/js-editor/js-editor.tsx`
