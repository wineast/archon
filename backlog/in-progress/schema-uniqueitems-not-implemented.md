# Schema uniqueItems 字段已定义但 Zod 层未实现

- **类型**: bug
- **优先级**: medium
- **发现日期**: 2026-02-19
- **工作区**: schema-runtime-fixes

## 描述

`SchemaProperty` 定义了 `uniqueItems?: boolean`，UI 上可以设置，但 `buildInputSchema` 完全没有处理这个字段。用户设了 uniqueItems 后实际不生效，属于静默失败。

## 分析

`web/src/lib/schemas/types.ts:40` — 类型定义存在：

```typescript
uniqueItems?: boolean;
```

`web/src/lib/tools/schema-builder.ts:37-45` — array 分支只处理了 `minItems` 和 `maxItems`，没有 `uniqueItems`：

```typescript
case "array": {
  // ...
  if (param.minItems != null) schema = (schema as z.ZodArray<z.ZodTypeAny>).min(param.minItems);
  if (param.maxItems != null) schema = (schema as z.ZodArray<z.ZodTypeAny>).max(param.maxItems);
  break;
}
```

Zod 没有原生 `uniqueItems` 支持，需要用 `.refine()` 实现。

## 修复方向

在 array 分支添加 refine 校验：

```typescript
if (param.uniqueItems) {
  schema = (schema as z.ZodArray<z.ZodTypeAny>).refine(
    (arr) => new Set(arr.map(JSON.stringify)).size === arr.length,
    { message: "Array items must be unique" }
  );
}
```

注意：`z.refine()` 返回 `ZodEffects`，无法直接被 `zod-to-json-schema` 转为 `"uniqueItems": true`。AI SDK 转出的 JSON Schema 里不会体现这个约束，但 Zod 运行时验证能生效。如果要让 LLM 看到 uniqueItems 约束，需要在 description 中注明或自行生成 JSON Schema。
