# 修复报告：Batch 模式 judgeConfigSnapshot 补全 promptTemplate / turnPromptTemplate

> 修复时间：2026-03-02
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 分支：`dev-eval-batch-judge-config-snapshot-missing-fields-20260302`

## 1. Root Cause（根因）

### 为什么坏了
`batch/route.ts` 在创建 batch 记录和 per-run 记录时，手动构造 `judgeConfigSnapshot` 对象只复制了 `name` 和 `dimensions`，遗漏了 `promptTemplate` 和 `turnPromptTemplate`。这是 batch 功能开发时从 `run/route.ts` 复制代码时的遗漏。

### 因果链
1. 用户在 judge config 中配置了自定义 `promptTemplate` / `turnPromptTemplate`
2. → batch 路由从 DB 正确读取了含这两个字段的 `judgeConfig`
3. → 但构造快照对象时只取了 `name` + `dimensions`，丢弃了模板字段
4. → `execute-case.ts` 从快照读到 `undefined`，fallback 为 `null`
5. → `renderJudgePrompt` 使用默认模板代替用户自定义模板

## 2. Change（变更）

### 修改摘要
在 `batch/route.ts` 两处 `judgeConfigSnapshot` 构造中补上 `promptTemplate` 和 `turnPromptTemplate` 字段，与 `run/route.ts` 对齐。新增 batch route 的单元测试覆盖此场景。

### 修改明细
| 文件 | 改动 | 说明 |
|------|------|------|
| `web/src/app/api/eval/batch/route.ts:129-130` | 新增 `promptTemplate` + `turnPromptTemplate` | batch 级快照补全 |
| `web/src/app/api/eval/batch/route.ts:163-164` | 新增 `promptTemplate` + `turnPromptTemplate` | per-run 级快照补全 |
| `web/src/app/api/eval/batch/__tests__/create-batch.test.ts` | 新增文件 | 4 个测试覆盖快照完整性、API 返回、inngest 事件 |

## 3. Rationale（决策依据）

### 为什么选择此方案
直接在构造快照的位置补全字段——改动最小、与 `run/route.ts` 的实现保持一致、无副作用。

### 考虑过的替代方案
| 方案 | 未采用原因 |
|------|-----------|
| 抽取 `buildJudgeConfigSnapshot()` 公共函数 | 修改面更大，且目前只有两处调用，抽象收益不高 |
| 在 `execute-case.ts` 侧补偿查询 | 下游补偿会引入额外 DB 查询和复杂度，且快照的意义就是冻结创建时刻的配置 |

### 已知局限
无。两处快照现在与 `run/route.ts` 完全一致。

## 4. Blast Radius（影响范围）

### 直接影响
- Batch 模式创建的 eval run 记录将包含完整的 judge 配置快照

### 间接影响
无。`execute-case.ts` 已正确处理这两个字段的读取逻辑（`?? null` fallback），不需要任何下游改动。

### 不影响
- 单次 run 模式（`run/route.ts`）——本来就是正确的
- judge 评估逻辑（`execute-case.ts`）——只是消费方，无需改动
- 前端展示——`judgeConfigSnapshot` 在 UI 中仅用于显示 name 和 dimensions

## 5. Verification（验证方式）

### 静态检查
- `make typecheck`：通过
- `make test`：通过（123 文件 / 1394 用例，含新增 4 个）

### 正向验证
新增单元测试直接验证：
- batch 级 `judgeConfigSnapshot` 包含 `promptTemplate` + `turnPromptTemplate`
- per-run 级 `judgeConfigSnapshot` 包含 `promptTemplate` + `turnPromptTemplate`

### 回归验证
- 全量测试套件通过，无回归

## 过程备注

[确认] 修复极为直接——补全 2 处各 2 行代码。风险几乎为零。
