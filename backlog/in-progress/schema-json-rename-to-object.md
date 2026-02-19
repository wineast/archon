# type: "json" 改为 type: "object" 对齐标准命名

- **类型**: cleanup
- **优先级**: high
- **发现日期**: 2026-02-19
- **工作区**: schema-type-system-overhaul

## 描述

对齐目标：ToolParameter 的类型名与 JSON Schema / Zod 标准一致。

当前 `type: "json"` 对应的是 JSON Schema 的 `type: "object"` 和 Zod 的 `z.object()`。命名为 "json" 语义模糊——JSON 是一种序列化格式，不是一种数据类型。object 才是类型。

## 分析

涉及的改动面：
- `web/src/lib/tools/types.ts:1` — `ToolParamType` 类型定义，`"json"` → `"object"`
- `web/src/lib/tools/schema-builder.ts:47` — `case "json"` → `case "object"`
- 数据库中 schemas 表的 `parameters` JSONB 内存储的 type 值
- 前端 parameter 编辑器的类型选择 UI
- 所有 seed 数据和测试用例

## 修复方向

1. 修改 `ToolParamType`：`"string" | "number" | "boolean" | "enum" | "object"`
2. 数据迁移：扫描 schemas 表和 tools/functions 关联的 JSONB，将 `"json"` 替换为 `"object"`
3. 更新 schema-builder、UI 组件、测试
