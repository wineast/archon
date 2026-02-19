# ToolParameter 重命名为通用的 Schema 类型名

- **类型**: cleanup
- **优先级**: medium
- **发现日期**: 2026-02-19
- **工作区**: schema-type-system-overhaul

## 描述

`ToolParameter` 最初只用于工具参数定义，但现在它已经是 Schema 系统的底层抽象，被多个模块引用：
- Tools 的输入/输出参数
- Functions 的输入/输出参数
- Object Types（Ontology）的属性定义
- Schema includes 的组合单元

命名为 "ToolParameter" 语义过窄，其他模块引用时会产生困惑——"为什么 ObjectType 的属性要用 Tool 的 Parameter 类型？"

## 分析

`web/src/lib/tools/types.ts:3-21` — `ToolParameter` 接口定义在 `tools/` 目录下。

引用方：
- `web/src/db/schema.ts:307` — schemas 表 `parameters` 字段类型为 `ToolParameter[]`
- `web/src/lib/schemas/resolve.ts:4` — `ResolvedParameter extends ToolParameter`
- `web/src/lib/tools/schema-builder.ts` — `buildInputSchema()` 入参
- `web/src/lib/template/render.ts` — `schemaMap: Record<string, ToolParameter[]>`
- 前端 Schema 编辑器组件

## 修复方向

1. 重命名 `ToolParameter` → `SchemaProperty`（或 `SchemaField` / `PropertyDefinition`）
2. 重命名 `ToolParamType` → `SchemaPropertyType`（或 `FieldType`）
3. 将类型定义从 `web/src/lib/tools/types.ts` 移到 `web/src/lib/schemas/types.ts`
4. tools/types.ts 中的 `ToolDefinition` 等工具专属类型保留原位
