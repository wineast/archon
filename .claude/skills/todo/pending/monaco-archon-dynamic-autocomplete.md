---
priority: P1
---
# Monaco 编辑器接入 archon:* 动态类型补全

`generateFnDeclarations` / `generateLibDeclarations` / `generateComponentDeclarations` 已在 `archon-types.ts` 中定义，但没有任何 `JsEditor` 调用方传入 `moduleDeclarations` prop。

需要在函数编辑器、工具 Handler 编辑器、组件编辑器中，根据当前 Agent 的资源列表动态生成类型声明并传入，使 `archon:fn/<key>`、`archon:lib/<key>`、`archon:component/<key>` 获得自动补全。
