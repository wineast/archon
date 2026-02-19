# Schema 支持 union 类型（对齐 JSON Schema oneOf / Zod union）

- **类型**: cleanup
- **优先级**: medium
- **发现日期**: 2026-02-19
- **工作区**: schema-type-expansion

## 描述

对齐目标：支持 JSON Schema 的 `oneOf` / `anyOf` 和 Zod 的 `z.union()` / `z.discriminatedUnion()`。

当前无法表达"根据某个字段的值决定其他字段的结构"。例如支付工具中 `method: "credit_card"` 和 `method: "bank_transfer"` 需要不同的字段集合，当前只能把所有字段列出来设为 optional。

## 分析

`web/src/lib/tools/types.ts` — 无分支/联合语义。
`web/src/lib/tools/schema-builder.ts` — 只生成 `z.object()`，无 `z.union()` 路径。

## 修复方向

建议分阶段：

1. **P1：discriminatedUnion** — 在 ToolParameter 中增加 `discriminator` + `variants` 字段，按枚举值关联不同子字段集合。Zod 侧用 `z.discriminatedUnion()` 生成
2. **P2：通用 union** — 支持字段可以是多种类型之一（`string | number`），Zod 侧用 `z.union()` 生成
