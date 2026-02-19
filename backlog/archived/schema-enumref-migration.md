# enumRef 字符串引用迁移为 enumDatasetId UUID FK

- **类型**: cleanup
- **优先级**: medium
- **发现日期**: 2026-02-19
- **功能树**: Schema 组合与引用增强
- **工作区**: schema-enumref-cleanup

## 描述

当前 enum 解析有三套路径：`enumDatasetId`（UUID）、`enumRef`（字符串 key）、`enum`（硬编码数组）。`enumRef` 是早期设计遗留，没有 FK 约束，Dataset 改名或删除后会变成悬挂引用，静默失败退化为普通 string。

## 分析

`web/src/lib/tools/schema-builder.ts:22-36` 三级优先级：

```typescript
// 1. enumDatasetId → by UUID（正确做法）
if (param.enumDatasetId && options?.datasetsById?.[param.enumDatasetId] != null) { ... }
// 2. enumRef → by key（向后兼容，无 FK 约束）
if (!resolvedEnum && param.enumRef && resolvedVars?.[param.enumRef] != null) { ... }
// 3. fallback to hardcoded enum[]
if (!resolvedEnum) { resolvedEnum = param.enum; }
```

`features/README.md:45` 已规划此迁移但未执行。

## 修复方向

1. 扫描所有现有 schema 的 `parameters` JSONB，将 `enumRef` 转换为对应 dataset 的 `enumDatasetId`
2. 从 `ToolParameter` 接口中移除 `enumRef` 字段
3. 从 `buildParamSchema()` 中移除 `enumRef` 解析分支
