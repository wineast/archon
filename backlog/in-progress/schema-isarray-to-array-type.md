# isArray 标记改为独立 type: "array" + items

- **类型**: cleanup
- **优先级**: high
- **发现日期**: 2026-02-19
- **工作区**: schema-type-system-overhaul

## 描述

对齐目标：数组应该是独立类型，对应 JSON Schema 的 `type: "array"` + `items` 和 Zod 的 `z.array()`。

当前设计用 `isArray?: boolean` 标记把数组当作任意类型的修饰符。这导致：
1. 无法表达数组自身的约束（`minItems` / `maxItems` / `uniqueItems`），JSON Schema 和 Zod 都支持这些
2. 无法表达嵌套数组（`string[][]`），因为 `isArray` 只有一层
3. 语义不对齐——JSON Schema 中 array 是一等类型，有自己的 `items` schema

## 分析

当前实现 `web/src/lib/tools/schema-builder.ts:96-98`：

```typescript
if (param.isArray) {
  schema = z.array(schema); // 简单包一层，无法加约束
}
```

`web/src/lib/tools/types.ts:10` — `isArray?: boolean` 只是一个布尔标记。

## 修复方向

1. 在 `ToolParamType` 中新增 `"array"`
2. 新增 `items?: ToolParameter` 字段描述数组元素类型
3. 新增数组约束字段：`minItems` / `maxItems` / `uniqueItems`
4. `buildParamSchema()` 中 `case "array"` 从 `items` 递归构建元素 schema，再包装为 `z.array()`
5. 迁移现有数据：`{ type: "string", isArray: true }` → `{ type: "array", items: { type: "string" } }`
6. 移除 `isArray` 字段

对齐后的结构示例：
```typescript
// 字符串数组，至少 1 项
{ type: "array", items: { type: "string" }, minItems: 1 }

// 对象数组
{ type: "array", items: { type: "object", schemaId: "xxx" } }

// Zod 输出: z.array(z.string()).min(1)
```
