# 验证报告：Batch 模式 judgeConfigSnapshot 补全 promptTemplate / turnPromptTemplate

> 验证时间：2026-03-02
> 关联修复：[FIX_REPORT.md](FIX_REPORT.md)
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 分支：`dev-eval-batch-judge-config-snapshot-missing-fields-20260302`

## 1. Reproduction Result（复现验证）

### 验证方式
代码审查 + 单元测试验证。此缺陷为纯后端数据快照问题，修复后的代码与 `run/route.ts:130-135` 的正确实现完全对齐。新增单元测试直接验证 batch 级和 per-run 级 `judgeConfigSnapshot` 包含 `promptTemplate` 和 `turnPromptTemplate`。

### 结果
✅ 通过

修复后 `batch/route.ts` 两处 `judgeConfigSnapshot` 构造现在包含完整 4 字段（`name`、`dimensions`、`promptTemplate`、`turnPromptTemplate`），与 `run/route.ts` 一致。

### 证据
- `batch/route.ts:127-132`（batch 级）：4 字段完整 ✅
- `batch/route.ts:161-166`（per-run 级）：4 字段完整 ✅
- 新增测试 `create-batch.test.ts`：4/4 通过 ✅

## 2. Cause-Fix Coherence（因果一致性）

### Root Cause 可解释 Delta？
✅ 成立。`batch/route.ts` 构造快照时只取 `name` + `dimensions`，`execute-case.ts:130-131` 读到 `undefined` 后 fallback 为 `null`，`renderJudgePrompt(null, ...)` 使用默认模板。因果链完整且唯一。

### Change 可消除 Root Cause？
✅ 成立。补全 `promptTemplate` 和 `turnPromptTemplate` 字段后，`execute-case.ts` 能正确读到用户配置的模板值，不再 fallback。改动从机理上切断因果链——是"治病"而非"止痛"。

### Rationale 无漏洞？
✅ 无漏洞。直接补全字段是最小改动，替代方案（抽取公共函数、下游补偿）的排除理由合理。

### 结果
✅ 一致

## 3. Boundary Validation（边界验证）

### 测试的边界变体
| 变体 | 条件 | 结果 |
|------|------|------|
| promptTemplate 为 null | judge config 未配置自定义模板 | ✅ `judgeConfig.promptTemplate` 为 null，快照存 null，`execute-case.ts` 的 `?? null` 正确 fallback 到默认模板，行为不变 |
| turnPromptTemplate 为 null | judge config 只配了 promptTemplate 没配 turnPromptTemplate | ✅ 同上，单独 null 的字段正确传递 |
| repeatCount > 1 | batch 创建多个 run | ✅ 循环内每个 run 从同一个 `judgeConfig` 取值，所有 run 的快照一致 |
| 两个字段都非 null | 完整配置 | ✅ 新增测试直接覆盖此场景，`promptTemplate: "Custom prompt: {{ user_input }}"` + `turnPromptTemplate: "Turn prompt: {{ conversation }}"` 均正确写入 |

### 结果
✅ 通过

所有边界变体均表现正常。null 值传递无副作用（DB schema 的 `text()` 类型允许 null）。

## 4. Regression Result（回归验证）

### 静态检查
- `make typecheck`：通过
- `make test`：通过（123 文件 / 1394 用例）

### Blast Radius 区域验证
| 区域 | 修复报告声明 | 实际验证结果 |
|------|-------------|-------------|
| 单次 run 模式 (`run/route.ts`) | 不影响 | ✅ 代码未改动，现有测试全部通过 |
| judge 评估逻辑 (`execute-case.ts`) | 不影响 | ✅ 代码未改动，现有 13 个测试通过 |
| 前端展示 (`eval-run-report.tsx` 等) | 不影响 | ✅ UI 仅读取 `name` + `dimensions`，新增字段不影响渲染 |
| batch 记录 (`evalBatches`) | 直接影响 | ✅ 快照补全，新增测试覆盖 |
| per-run 记录 (`evalRuns`) | 直接影响 | ✅ 快照补全，新增测试覆盖 |

### 结果
✅ 通过

## 5. Verdict（裁定）

### 判决
✅ 合并

### 证据摘要
- **Reproduction**：修复后 batch 级和 per-run 级快照均包含完整 4 字段，与 `run/route.ts` 一致
- **Coherence**：根因→修复因果链完整，直接补全遗漏字段，无逻辑漏洞
- **Boundary**：null 值、多重复、完整配置三种边界均正常
- **Regression**：1394 个测试全部通过，影响区域无回归

### 残留风险
无。修复内容为纯数据透传（从 DB 读出→写入快照），无逻辑分支，无副作用。

## 过程备注

[确认] 此缺陷属于典型的"复制遗漏"类 bug，修复和验证都非常直接。代码审查 + 单元测试验证比 UI 端到端操作更精确——快照字段是否包含特定 key-value 在 UI 上不可直接观察。
