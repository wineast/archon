# Schema 缺少显式 JSON Schema 生成能力

- **类型**: feature
- **优先级**: low
- **发现日期**: 2026-02-19
- **工作区**: schema-standardization

## 描述

当前 SchemaProperty → JSON Schema 的转换完全依赖 AI SDK 内部的 `zod-to-json-schema` 隐式完成。没有独立的 `SchemaProperty → JSON Schema` 转换函数。

这意味着以下场景无法支持：

1. **API 文档导出**：无法生成标准 JSON Schema / OpenAPI 3.1 给第三方对接
2. **前端 Schema 预览**：无法在 UI 上展示 LLM 实际看到的 JSON Schema
3. **第三方工具互操作**：无法导入/导出标准 JSON Schema
4. **调试**：无法直接查看发给 LLM 的 tool parameters schema

此外，Zod 的某些特性（如 `.refine()`、`.transform()`）无法被 `zod-to-json-schema` 正确转换，会导致信息丢失（如 `uniqueItems` 约束在 JSON Schema 中不体现）。

## 分析

`web/src/lib/tools/schema-builder.ts` — 只有 `buildInputSchema()` 返回 Zod，没有 JSON Schema 输出。

`web/src/app/api/chat/tools/build-dynamic-tools.ts` — tool() 接收 Zod schema，AI SDK 内部自动转换。

## 修复方向

新增 `buildJsonSchema(parameters: SchemaProperty[]): JSONSchema7` 函数，直接从 SchemaProperty 生成标准 JSON Schema，不经过 Zod 中间层。

可选方案：

1. **直接生成**（推荐）：SchemaProperty → JSON Schema，手写映射，完全可控
2. **通过 Zod 转**：buildInputSchema → zod-to-json-schema，但受 Zod 限制

推荐方案 1，因为 SchemaProperty 的字段设计本身就贴近 JSON Schema，映射很直接。
