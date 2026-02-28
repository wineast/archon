# Dataset data 导出时类型不一致——JSON 对象 vs 字符串

## Symptom（看到了什么）

Dataset 的 `data` 字段在导出（export agent）时，如果用户输入的是合法 JSON，会被导出为 **JSON 对象**而非字符串。但从模板引擎使用角度看，data 本质上是文本（2 层 JSON 结构的字符串），导出类型应该保持一致。

具体表现：
- 用户在 Dataset 编辑器输入 `{"users": ["Alice"]}` → 保存到 DB 时是 `jsonb` 对象 → 导出为 JSON 对象
- 用户输入非法 JSON 文本 → 保存为字符串 → 导出为 JSON 字符串
- 同一个字段在导出文件中可能是对象也可能是字符串，类型不可预测

## Trigger（怎么触发的）

导出 Agent 时触发。前端 `dataset-form.tsx` 的 `parseData()` 函数在保存时对用户输入做了 `JSON.parse` 尝试——成功就存对象，失败就存字符串，导致 DB 中 `data` 字段类型不统一。

## Locale（大概在哪）

- **DB Schema**: `web/src/db/schema.ts` — `datasets.data` 字段是 `jsonb` + `unknown` 类型
- **前端表单**: `web/src/components/datasets/dataset-form.tsx` — `parseData()` 函数（~L81-88）
- **快照构建**: `web/src/lib/versions/snapshot.ts` — `buildSnapshot()` 中 dataset 导出（~L278-285）直接传 `d.data` 不做转换
- **类型定义**: `web/src/lib/versions/types.ts` — `DatasetSnapshotItem.data: unknown`

## Hypothesis（猜是什么原因）

根源在于 `parseData()` 的"智能"解析策略——尝试 `JSON.parse`，成功存对象、失败存字符串。这导致同一字段在数据库中有两种可能的运行时类型。

对比 `systemPrompt`（`text` 类型，始终字符串）和 `promptTemplate`（`text` 类型，始终字符串），Dataset 的 `data` 用 `jsonb` 是合理的（需要存结构化数据供模板引擎遍历），但导出/导入时缺少类型规范化。

两个可能的修复方向：
1. **导出时统一 stringify**：导出时一律 `JSON.stringify(data)`，导入时一律 `JSON.parse(data)`，保证 fixture 文件中 data 始终是字符串
2. **保持 jsonb 但约束类型**：将 `unknown` 收窄为 `Record<string, unknown>[] | Record<string, unknown>`，在 schema 和 snapshot 类型中明确——但这不解决"导出为对象"的问题
