# Schema defaultValue 字段已定义但 Zod 层未实现

- **类型**: bug
- **优先级**: medium
- **发现日期**: 2026-02-19
- **工作区**: schema-runtime-fixes

## 描述

`SchemaProperty` 定义了 `defaultValue?: unknown`，但 `buildInputSchema` 没有调用 `.default()`。导致：

1. Zod 验证时不会填充默认值——optional 字段缺失时结果是 `undefined`，而不是用户设定的默认值
2. AI SDK 转出的 JSON Schema 里没有 `"default": ...`——LLM 看不到默认值信息
3. 用户在 UI 上配置了默认值但实际无效

## 分析

`web/src/lib/schemas/types.ts:9` — 类型定义存在：

```typescript
defaultValue?: unknown;
```

`web/src/lib/tools/schema-builder.ts:159-181` — `buildInputSchema` 处理了 `description` 和 `required`，但没有 `defaultValue`。

`web/src/lib/tools/schema-builder.ts:93-110` — 嵌套 object 同样没有处理。

## 修复方向

在 `buildInputSchema` 和 `buildNestedObject` 中，对 optional 字段应用 `.default()`：

```typescript
if (!param.required) {
  if (param.defaultValue !== undefined) {
    schema = schema.default(param.defaultValue);
  } else {
    schema = schema.optional();
  }
}
```

注意：`.default()` 和 `.optional()` 在 Zod 中是不同的——`.default(v)` 表示缺失时填 v（字段始终有值），`.optional()` 表示缺失合法（值可能为 undefined）。需要确认产品意图是哪种语义。
