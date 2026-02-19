# Schema "enum" 作为独立类型与 JSON Schema 标准存在语义差异

- **类型**: cleanup
- **优先级**: low
- **发现日期**: 2026-02-19
- **工作区**: schema-standardization

## 描述

`SchemaPropertyType` 把 `"enum"` 作为与 `"string"` 并列的独立类型。但在 JSON Schema 标准中，`enum` 不是类型，而是对 `string`（或任意类型）的值约束：

```json
{ "type": "string", "enum": ["a", "b", "c"] }
```

当前 `z.enum()` 转出的 JSON Schema 确实是上述格式，所以**功能上没有问题**。但语义模型的差异在以下场景会成为障碍：

1. JSON Schema 导入：外部 JSON Schema 用 `{"type": "string", "enum": [...]}` 表示，需要映射为 `type: "enum"`
2. JSON Schema 导出：需要把 `type: "enum"` 映射回标准格式
3. OpenAPI 互操作：OpenAPI 3.1 使用 JSON Schema，`enum` 不是 type

## 分析

`web/src/lib/schemas/types.ts:1`:

```typescript
export type SchemaPropertyType = "string" | "number" | "boolean" | "enum" | "object" | "array";
```

`web/src/lib/tools/schema-builder.ts:47-56` — enum 分支独立于 string。

## 修复方向

当前阶段可以不改——功能上没有 bug。当需要做 JSON Schema 导入/导出时，在转换层处理映射：

- 导入：`{"type": "string", "enum": [...]}` → `{type: "enum", enum: [...]}`
- 导出：`{type: "enum", enum: [...]}` → `{"type": "string", "enum": [...]}`
