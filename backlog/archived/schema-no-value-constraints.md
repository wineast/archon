# Schema 缺少值约束（对齐 JSON Schema 标准约束）

- **类型**: cleanup
- **优先级**: high
- **发现日期**: 2026-02-19
- **工作区**: schema-type-system-overhaul

## 描述

对齐目标：每种类型的约束字段与 JSON Schema / Zod 一一对应。

当前 `ToolParameter` 只有类型信息，没有任何值约束。JSON Schema 和 Zod 对每种类型都有丰富的约束支持，这些约束直接影响 LLM 工具调用的参数准确率。

## 分析

`web/src/lib/tools/types.ts:3-21` — 接口中无约束字段。

需要补齐的约束（按类型）：

**string** — 对应 Zod `.min()` / `.max()` / `.regex()` / `.email()` / `.url()` 等：
- `minLength` / `maxLength`
- `pattern`（正则）
- `format`（email / url / date / date-time / uuid）

**number** — 对应 Zod `.min()` / `.max()` / `.int()` / `.multipleOf()`：
- `minimum` / `maximum`
- `exclusiveMinimum` / `exclusiveMaximum`
- `multipleOf`
- `integer`（JSON Schema 中 integer 是独立类型，但可以作为 number 的约束实现）

**array**（见 `schema-isarray-to-array-type` issue）：
- `minItems` / `maxItems`
- `uniqueItems`

**object**：
- 固定字段已有（properties / schemaId）
- `additionalProperties`（见 `schema-no-map-type` issue）

## 修复方向

在 `ToolParameter` 上按类型增加扁平的可选约束字段（不嵌套 constraints 对象，与 JSON Schema 平级结构对齐）：

```typescript
interface ToolParameter {
  // ... 现有字段
  // string constraints
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: 'email' | 'url' | 'date' | 'date-time' | 'uuid';
  // number constraints
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  integer?: boolean;
  // array constraints (配合 type: "array" 改造)
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}
```

`buildParamSchema()` 中根据约束字段链式调用 Zod 方法。
