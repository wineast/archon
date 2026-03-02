# 修复报告：Eval Run 快照 versionId 消除配置漂移

> 修复时间：2026-03-02 12:10
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 分支：`dev-eval-run-versionid-drift-20260302`

## 1. Root Cause（根因）

### 为什么坏了
`evalRuns` 表设计时只快照了 modelConfig 的三个字段（modelId、systemPrompt、temperature），遗漏了 `versionId`。`executeCase` 中通过 `resolveEditingVersionId(agentId)` 实时查询 `agents.editingVersionId`——该字段会随用户发布/切换版本而变化。

### 因果链
1. Run 创建时 `resolveEditingVersionId` 解析出 versionId V1，用 V1 读取 modelConfig 并快照到 run 记录，但 **versionId 本身未存入 run**
2. → 用户在 eval 运行期间发布新版本，`agents.editingVersionId` 从 V1 变为 V2
3. → 后续 case 执行时 `resolveEditingVersionId` 返回 V2，用 V2 的 tools/datasets/wiki/functions/schemas + V1 的 systemPrompt 执行，导致 Liquid 变量和工具名不匹配

## 2. Change（变更）

### 修改摘要
在 `evalRuns` 表新增 `chatVersionId` 列，run 创建时写入，case 执行时使用快照值替代实时查询。

### 修改明细
| 文件 | 改动 | 说明 |
|------|------|------|
| `web/src/db/schema.ts:726` | 新增 `chatVersionId: uuid("chat_version_id")` | nullable，兼容已有 run 记录 |
| `web/src/app/api/eval/run/route.ts:119` | 插入时增加 `chatVersionId: versionId` | 快照创建时解析的 versionId |
| `web/src/lib/eval/execute-case.ts:136` | `run.chatVersionId ?? undefined` 替代 `resolveEditingVersionId(evalAgentId)` | 使用快照值 |
| `web/src/lib/eval/execute-case.ts:16` | 移除 `import { resolveEditingVersionId }` | 不再需要 |
| `web/src/lib/eval/__tests__/execute-case.test.ts:80` | baseRun 添加 `chatVersionId: "version-1"` | 适配新字段 |
| `web/src/lib/eval/__tests__/execute-case.test.ts` | 移除 `resolveEditingVersionId` mock | 不再被调用 |
| `web/src/app/api/eval/batch/route.ts:148` | 插入时增加 `chatVersionId: versionId` | batch 创建的 run 也快照 versionId |
| `web/src/app/api/eval/run/[runId]/case/__tests__/run-case.test.ts` | mock run 数据添加 `chatVersionId: "version-1"` | 适配新字段 |

## 3. Rationale（决策依据）

### 为什么选择此方案
与 systemPrompt/temperature/modelId 的快照模式保持一致——run 创建时冻结所有执行上下文，case 执行时只读快照。改动最小（3 个业务文件 + 2 个测试文件），逻辑清晰。

### 考虑过的替代方案
| 方案 | 未采用原因 |
|------|-----------|
| 深度快照所有资源（tools、datasets、wiki 等）到 run 的 JSONB 列 | 数据量大，schema 复杂，且资源结构变化时快照格式需同步维护 |
| 在 run 执行前锁定 agent 版本（禁止切换） | 侵入性强，影响其他并行操作；且多用户场景下不现实 |

### 已知局限
- 已有的旧 run 记录 `chatVersionId` 为 null，重跑这些 run 的 case 时仍会使用当前编辑版本（降级到旧行为）
- Judge agent 的 versionId 未做同样的快照处理（当前 judge 的 modelConfig 已经是 JSONB 全量快照，影响较小）

## 4. Blast Radius（影响范围）

### 直接影响
- Eval Run 创建 API（`/api/eval/run`）：新增一个字段写入
- Eval Case 执行（`executeCase`）：读取来源从实时查询改为快照
- Inngest eval-case-worker：间接调用 `executeCase`，行为跟随变化

### 间接影响
- 无。`chatVersionId` 是新增列，不影响其他读取 evalRuns 的地方

### 不影响
- Chat 聊天路由（不经过 eval 链路）
- Agent 发布/版本管理
- 其他 eval 相关 API（list runs、get results 等只读接口）

## 5. Verification（验证方式）

### 静态检查
- `make typecheck`：通过
- `make test`：121 文件 / 1381 用例全部通过

### 正向验证
代码级验证——修复后的数据流：
1. `route.ts:57` → `resolveEditingVersionId(agentId)` 返回 versionId
2. `route.ts:119` → `chatVersionId: versionId` 写入 run 记录 ✅
3. `execute-case.ts:136` → `run.chatVersionId` 读取快照值（不再调用 resolveEditingVersionId）✅
4. 即使 `agents.editingVersionId` 在执行期间变化，case 仍使用 run 创建时的版本

### 回归验证
- 已有的 execute-case 测试（11 个用例）全部通过，覆盖 single/injected/sequential 三种模式
- run-case 集成测试（9 个用例）全部通过，覆盖 tools 传递、judge 调用、错误处理

## 过程备注

- [确认] `chatVersionId` 设为 nullable（无 `.notNull()`），兼容已有数据，`execute-case.ts` 中 `?? undefined` 处理 null 回退
- [确认] `route.ts` 中 `versionId` 变量在第 57 行就已存在且正确，只需在 insert 时引用它
