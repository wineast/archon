# Schema 支持 additionalProperties / record 类型（对齐 JSON Schema）

- **类型**: cleanup
- **优先级**: low
- **发现日期**: 2026-02-19
- **工作区**: schema-type-expansion

## 描述

对齐目标：支持 JSON Schema 的 `additionalProperties` 和 Zod 的 `z.record()`。

当前 `type: "object"` 的字段名必须在定义时确定，无法表达 `Record<string, T>` 这种动态 key 结构。

## 分析

`web/src/lib/tools/schema-builder.ts:48-78` — object 类型只支持固定 properties 或 schemaId，退化为 `z.unknown()`。

## 修复方向

在 `type: "object"` 的 ToolParameter 上增加 `additionalProperties` 字段：

```typescript
interface ToolParameter {
  // ... 现有字段
  /** For object type: schema for dynamic-key values (Record<string, T>) */
  additionalProperties?: ToolParameter;
}
```

Zod 侧：有固定 properties + additionalProperties → `z.object({...}).catchall(z.number())`；无固定 properties 只有 additionalProperties → `z.record(z.string(), z.number())`。
