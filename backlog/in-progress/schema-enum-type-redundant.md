# Schema enum 与 string 分支逻辑重叠

- **类型**: cleanup
- **优先级**: medium
- **发现日期**: 2026-02-19
- **工作区**: schema-type-system-overhaul

## 描述

对齐目标：`type: "enum"` 对应 Zod 的 `z.enum()`，`type: "string"` 对应 `z.string()`，两者互不干涉。

当前问题：
1. `type: "string"` 的 `default` 分支包含 enum 解析逻辑——string 字段不可能绑 `enumDatasetId`，这段代码在处理不该存在的状态
2. `type: "enum"` 没有 enum 值时静默退化为 `z.string()`——应该报错

## 分析

`web/src/lib/tools/schema-builder.ts:80-93`：两个分支代码完全相同，没有守住各自的语义边界。

## 修复方向

1. `default`（string）分支：去掉 enum 解析，直接 `schema = z.string()`
2. `case "enum"` 分支：没有 enum 值时抛错或记录警告，不退化
