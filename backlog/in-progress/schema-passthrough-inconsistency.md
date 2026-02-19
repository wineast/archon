# Schema object 类型 passthrough 行为不一致

- **类型**: cleanup
- **优先级**: low
- **发现日期**: 2026-02-19
- **工作区**: schema-runtime-fixes

## 描述

嵌套 object 使用了 `.passthrough()`（允许额外字段），但顶层 schema 没有。这导致行为不一致：

- 顶层：LLM 传入的多余字段被 Zod 静默 strip
- 嵌套 object：LLM 传入的多余字段会被保留

## 分析

`web/src/lib/tools/schema-builder.ts:109` — 嵌套 object：

```typescript
return z.object(nested).passthrough();
```

`web/src/lib/tools/schema-builder.ts:180` — 顶层：

```typescript
return z.object(shape); // 无 passthrough
```

JSON Schema 层面：
- `.passthrough()` → `"additionalProperties": true`
- 默认行为 → `"additionalProperties": false`（AI SDK 转换时的默认）

## 修复方向

两个方案：

1. **统一为不加 passthrough**（推荐）：嵌套 object 也去掉 `.passthrough()`，保持严格校验。LLM 不应该传入 schema 以外的字段。
2. **统一为加 passthrough**：顶层也加 `.passthrough()`，宽松处理。

推荐方案 1，因为工具调用场景下，LLM 输出应严格匹配 schema 定义。
