# Tool 输出 Schema 只定义不验证

- **类型**: cleanup
- **优先级**: medium
- **发现日期**: 2026-02-19
- **工作区**: schema-runtime-integrity

## 描述

Tools 有 `returnParametersSchemaId` 字段，但 `buildDynamicTools()` 只构建了 input schema 用于 Zod 验证，output schema 仅在模板渲染时作为 `{{ tool.output_schema }}` 提供给 LLM 参考，没有实际的运行时验证。

如果未来要做工具链（Tool A 的输出自动传给 Tool B 的输入），没有输出验证会导致数据链路不可靠——上游工具返回了错误结构，下游工具拿到的数据不符合预期。

## 分析

`web/src/app/api/chat/tools/build-dynamic-tools.ts:83-90` — 只用了 input schema：

```typescript
const inputSchema = buildInputSchema(
  def.parameters,
  templateData?.resolvedVars,
  { datasetsById: templateData?.datasetsById, schemaMap: templateData?.schemaMap }
);
```

`ToolDefinitionPayload` 中 `returnParameters` 字段存在但在 `buildDynamicTools` 中未被使用。

## 修复方向

1. 在 `buildDynamicTools()` 中也为 output 构建 Zod schema
2. 工具执行后用 output schema 验证返回值，验证失败时记录警告或返回结构化错误
3. 为未来的工具链功能预留输出类型检查接口
