# 工具测试用例 — 断言（Assertions）

## 概述

工具测试用例支持两种判定方式，可独立或组合使用：

| 方式 | 字段 | 说明 |
|------|------|------|
| **精确匹配** | `expectedOutput` | 工具输出必须与预期值 `deepEqual` |
| **断言规则** | `assertions` | 对输出的 JSON 字符串执行规则匹配 |

两者组合使用时，**均需通过**才算测试通过。

## 断言类型

复用 eval 模块的 `Assertion` 机制（`@/lib/eval/types`），支持以下类型：

| 类型 | 说明 | value 示例 |
|------|------|------------|
| `contains` | 输出包含指定文本（不区分大小写） | `"universe"` |
| `not-contains` | 输出不包含指定文本 | `"error"` |
| `regex` | 输出匹配正则表达式 | `"\"exclusive\":\\s*true"` |
| `length-min` | 输出长度不小于 | `"100"` |
| `length-max` | 输出长度不超过 | `"5000"` |
| `json-valid` | 输出是合法 JSON | （value 忽略） |

## 数据模型

### toolTestCases 表

```
assertions JSONB NOT NULL DEFAULT '[]'
```

类型：`Assertion[]`，每个元素 `{ id, type, value }`。

### toolTestRunResults 表

```
assertion_results JSONB
```

类型：`AssertionResult[] | null`，记录每条断言的判定结果 `{ assertion, passed, message }`。

## 判定逻辑

```ts
let passed = true;
if (expectedOutput != null) {
  passed = passed && deepEqual(result, expectedOutput);
}
if (assertions.length > 0) {
  assertionResults = runAllAssertions(assertions, JSON.stringify(result));
  passed = passed && assertionResults.every(r => r.passed);
}
```

- `expectedOutput` 为 `null` 时跳过精确匹配
- `assertions` 为空数组时跳过断言检查
- 两者都为空时默认 `passed = true`

## UI

### Test Case 编辑区

在 Expected Output 编辑器下方新增 **Assertions** 区域：

- Label "Assertions" + Add 按钮
- 每行一个 `AssertionRow`（复用 `@/components/eval/assertion-row`）
- 支持选择类型、输入 value、删除

### 运行结果区

当存在 `assertionResults` 时，在输出下方显示每条断言的通过/失败状态：

- 绿色 ✓ + 消息：断言通过
- 红色 ✗ + 消息：断言失败

### Run All 批量运行

批量运行时自动携带每个 test case 的 `assertions`，结果存入 `toolTestRunResults.assertionResults`。

## API

### POST `/api/tools/[id]/test-cases`

请求体新增：

```json
{
  "assertions": [
    { "id": "a1", "type": "contains", "value": "universe" }
  ]
}
```

### PUT `/api/tools/[id]/test-cases/[caseId]`

支持更新 `assertions` 字段。

### POST `/api/tools/[id]/test-cases/run`

请求体新增：

```json
{
  "assertions": [...]
}
```

响应新增：

```json
{
  "assertionResults": [
    { "assertion": {...}, "passed": true, "message": "..." }
  ]
}
```

### POST `/api/tools/[id]/test-runs/[runId]/case`

请求体新增 `assertions`，结果存入 DB 的 `assertion_results` 字段。

## 快照（Snapshot）

`ToolTestCaseSnapshotItem` 增加可选字段 `assertions?: Assertion[]`，向后兼容旧快照（缺失时恢复为空数组）。

## 相关文件

| 文件 | 说明 |
|------|------|
| `web/src/db/schema.ts` | `toolTestCases.assertions` + `toolTestRunResults.assertionResults` |
| `web/src/lib/eval/types.ts` | `Assertion`、`AssertionResult` 类型 |
| `web/src/lib/eval/assertions.ts` | `runAllAssertions()` 断言执行 |
| `web/src/components/eval/assertion-row.tsx` | `AssertionRow` 断言编辑行 |
| `web/src/lib/versions/types.ts` | `ToolTestCaseSnapshotItem.assertions` |
| `web/src/lib/versions/snapshot.ts` | 快照导出/导入 assertions |
| `web/src/app/api/tools/[id]/test-cases/route.ts` | POST 支持 assertions |
| `web/src/app/api/tools/[id]/test-cases/[caseId]/route.ts` | PUT 支持 assertions |
| `web/src/app/api/tools/[id]/test-cases/run/route.ts` | 单次运行断言判定 |
| `web/src/app/api/tools/[id]/test-runs/[runId]/case/route.ts` | 批量运行断言判定 |
| `web/src/lib/tools/test-case-hooks.ts` | `runToolTestCase` 传递 assertions |
| `web/src/components/tools/tool-test-case-item.tsx` | 断言编辑 + 结果展示 |
| `web/src/components/tools/tool-test-case-create-form.tsx` | 创建表单支持 assertions |
| `web/src/components/tools/tool-test-cases-panel.tsx` | Run All 传递 assertions |
| `web/src/components/tools/tool-run-result-card.tsx` | 历史结果展示 assertionResults |
| `web/src/app/api/tools/__tests__/test-case-assertions.test.ts` | 断言判定逻辑测试 |
