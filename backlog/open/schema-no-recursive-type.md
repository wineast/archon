# Schema 支持递归/自引用类型（对齐 JSON Schema $ref / Zod lazy）

- **类型**: cleanup
- **优先级**: low
- **发现日期**: 2026-02-19

## 描述

对齐目标：支持 JSON Schema 的 `$ref` 自引用和 Zod 的 `z.lazy()`。

当前 `schemaId` 引用不允许指向自身（includes 的环检测会阻止），无法表达"评论包含子评论"等递归结构。

## 分析

需要区分两种环：
- **includes 环**（水平合并）：应该禁止，否则无限展开
- **schemaId 引用环**（垂直嵌套）：可以允许，通过 `z.lazy()` 延迟解析

`web/src/lib/schemas/resolve.ts:19` — `resolveParameters()` 对所有环一视同仁地阻止。
`web/src/lib/tools/schema-builder.ts:48` — `schemaId` 即时展开，无延迟解析。

## 修复方向

1. `resolveParameters()` 的环检测只应用于 includes，不影响 schemaId 嵌套引用
2. `buildParamSchema()` 检测到 schemaId 自引用时使用 `z.lazy()` 生成递归 schema
3. 设置最大递归深度防止无限展开
