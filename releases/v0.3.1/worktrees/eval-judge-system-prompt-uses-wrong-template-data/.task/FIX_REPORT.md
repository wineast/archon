# 修复报告：Judge systemPrompt 使用 judge agent 自身的 templateData 渲染

> 修复时间：2026-03-03 21:10
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 分支：`dev-eval-judge-system-prompt-uses-wrong-template-data-20260303`

## 1. Root Cause（根因）

### 为什么坏了
`executeCase` 函数只为被评估 agent 调用了一次 `gatherTemplateData`，收集的是被评估 agent 的数据集、Wiki、工具等模板数据。当渲染 judge agent 的 systemPrompt 时，直接复用了这份属于被评估 agent 的 `templateData`，导致 judge agent 独有的模板变量（如评分标准数据集）全部解析为空。

### 因果链
1. `executeCase` 第 136 行调用 `gatherTemplateData(evalAgentId, evalVersionId)` 只收集被评估 agent 的数据
2. → judge systemPrompt 渲染（第 335、385 行）复用了被评估 agent 的 `templateData`
3. → judge agent 独有的模板变量（如 `{{ scoring_criteria }}`）在被评估 agent 的数据中不存在，解析为空字符串
4. → judge 在评分时丢失关键上下文，评分结果不准确

深层原因：`evalRuns` 表只存储了 `judgeAgentId`，没有 `judgeVersionId` 字段，导致执行时无法为 judge agent gather 正确版本的 templateData。

## 2. Change（变更）

### 修改摘要
为 judge agent 单独收集 templateData：schema 新增 `judgeVersionId` 字段 → run 创建时持久化 → 执行时用 judge 自身的 templateData 渲染 judge systemPrompt。

### 修改明细
| 文件 | 改动 | 说明 |
|------|------|------|
| `web/src/db/schema.ts:731` | 新增 `judgeVersionId: uuid("judge_version_id")` | 与 `chatVersionId` 对称，存储 judge agent 的版本 ID |
| `web/src/app/api/eval/run/route.ts:125` | insert 时新增 `judgeVersionId` 字段 | run 创建时将已解析的 `judgeVersionId` 持久化 |
| `web/src/app/api/eval/batch/route.ts:154` | insert 时新增 `judgeVersionId` 字段 | batch run 创建同步修改 |
| `web/src/lib/eval/execute-case.ts:137-139` | 新增 `judgeTemplateData = await gatherTemplateData(judgeAgentId, judgeVersionId)` | 为 judge agent 单独收集 templateData |
| `web/src/lib/eval/execute-case.ts:337,387` | `templateData` → `judgeTemplateData` | judge systemPrompt 渲染使用 judge 自身的数据 |
| `web/src/lib/eval/execute-case.ts:436` | 新增 `disposeTemplateData(judgeTemplateData)` | finally 中释放 judge templateData |
| `web/src/lib/eval/__tests__/execute-case.test.ts:92` | baseRun 新增 `judgeVersionId` | 测试 mock 同步更新 |
| `web/src/lib/eval/__tests__/execute-case-versionid.guard.test.ts:104,190` | makeRun 新增 `judgeVersionId` + 修正 NthCalledWith 序号 | 守护测试适配双次 gather 调用 |

## 3. Rationale（决策依据）

### 为什么选择此方案
- **Schema 新增 `judgeVersionId`** 是必要的：`gatherTemplateData` 需要 `agentId` + `versionId` 两个参数，而 run 记录原本只有 `judgeAgentId` 没有版本信息
- **在 `executeCase` 层 gather 而非 render 层** 合理：templateData 在整个 case 执行期间复用（多次 renderTemplate 调用），在 execute 层 gather 一次 + finally dispose 与现有的 eval templateData 生命周期对称

### 考虑过的替代方案
| 方案 | 未采用原因 |
|------|-----------|
| 执行时用 `resolveEditingVersionId(judgeAgentId)` 动态解析版本 | 违反 eval run 快照原则——run 应使用创建时的版本快照，不应实时查询（已有守护测试 `execute-case-versionid.guard.test.ts` 保护此约束） |
| 合并 eval + judge 的 templateData | 语义不正确——judge 不应访问被评估 agent 的数据集，两者应完全隔离 |

### 已知局限
- Schema 变更需要 `db-push`（工作区）或迁移文件（dev/main）
- 旧 run 记录的 `judgeVersionId` 为 null，`gatherTemplateData` 收到 undefined 时会安全降级返回空数据（与旧行为一致，不会 break）

## 4. Blast Radius（影响范围）

### 直接影响
- Eval 执行引擎：judge systemPrompt 渲染改用 judge 自身的 templateData
- Eval run 创建 API（`/api/eval/run` + `/api/eval/batch`）：新增 `judgeVersionId` 字段写入

### 间接影响
- 无。eval templateData（用于 chatSystemPrompt 和 tools）保持不变

### 不影响
- Chat 路由（`/api/chat`）：不涉及 judge
- Agent 构建页面：不涉及 eval
- 其他 eval 功能（assertions、case 导入/导出、batch 聚合）：不涉及 templateData

## 5. Verification（验证方式）

### 静态检查
- `make typecheck`：通过
- `make test`（eval 相关 8 个文件 143 个测试）：全部通过
- 其他失败的测试（`partial-unique-index`、`chat-persistence`、`seed-idempotency`）为数据库连接问题，与本次修复无关

### 正向验证
本 bug 为纯后端数据流逻辑问题，无 UI 表征。通过代码审查 + 单元测试验证：
1. `executeCase` 现在调用两次 `gatherTemplateData`：第一次为被评估 agent，第二次为 judge agent
2. judge systemPrompt 渲染使用 `judgeTemplateData`（judge 自身的数据）
3. 两份 templateData 在 finally 中都被正确释放

### 回归验证
- 守护测试 `execute-case-versionid.guard.test.ts` 全部通过——确认快照 versionId 约束未被破坏
- `execute-case.test.ts` 全部通过——三种模式（single/injected/sequential）+ judge 评分正常工作
- eval 全套测试 143 个用例全部通过

## 过程备注

[确认] 守护测试 `execute-case-versionid.guard.test.ts` 的 NthCalledWith 断言需要适配——因为每次 executeCase 现在产生 2 次 gatherTemplateData 调用（eval + judge），序号从 (1,2) 变为 (1,3)
