# 验证报告：Judge systemPrompt 使用 judge agent 自身的 templateData 渲染

> 验证时间：2026-03-03 21:15
> 关联修复：[FIX_REPORT.md](FIX_REPORT.md)
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 分支：`dev-eval-judge-system-prompt-uses-wrong-template-data-20260303`

## 1. Reproduction Result（复现验证）

### 验证方式
本 bug 为纯后端数据流逻辑问题，无 UI 表征。通过代码审查独立确认修复有效性：

1. 审查修复后的 `execute-case.ts:134-140`——确认新增了 `judgeTemplateData = gatherTemplateData(judgeAgentId, judgeVersionId)`
2. 审查第 337 行（per-turn judge）和第 387 行（case-level judge）——确认 `renderTemplate` 的第二个参数从 `templateData` 改为 `judgeTemplateData`
3. 审查第 153 行（chatSystemPrompt）——确认仍使用 `templateData`（被评估 agent 数据），未被误改

### 结果
✅ 通过

修复正确地将 judge systemPrompt 渲染的数据源从被评估 agent 的 templateData 切换为 judge agent 自身的 judgeTemplateData。

## 2. Cause-Fix Coherence（因果一致性）

### Root Cause 可解释 Delta？
✅ 成立。`gatherTemplateData` 只被调用一次且传入的是被评估 agent 的 IDs，judge 渲染复用这份数据——逻辑上必然导致 judge 独有变量解析为空。不存在更合理的替代解释。

### Change 可消除 Root Cause？
✅ 成立。修复从机理上切断了因果链：为 judge agent 单独 `gatherTemplateData`，judge systemPrompt 使用 judge 自身的数据渲染。这是"治病"而非"止痛"——不是绕过问题（如硬编码降级），而是让 judge 正确获取自己的模板数据。

### Rationale 无漏洞？
✅ 成立。两个被排除的替代方案理由充分：
- `resolveEditingVersionId` 动态解析：违反快照原则，守护测试 `execute-case-versionid.guard.test.ts` 已保护此约束
- 合并 eval + judge 的 templateData：破坏 judge 与被评估 agent 的职责隔离，语义错误

Schema 新增 `judgeVersionId` 是必要前置：`gatherTemplateData` 需要 agentId + versionId 两参数，原表只有 `judgeAgentId`。

### 结果
✅ 一致

因果链完整，修复对症，决策合理。

## 3. Boundary Validation（边界验证）

### 测试的边界变体
| 变体 | 条件 | 结果 |
|------|------|------|
| 旧 run 记录（judgeVersionId=null） | `run.judgeVersionId` 为 null → `?? undefined` → `gatherTemplateData(judgeAgentId, undefined)` | ✅ `gatherTemplateData` 在 `!agentId \|\| !versionId` 时返回空数据（render.ts:210-211），与旧行为一致，不会 break |
| judge agent 无数据集 | judge agent 存在但无数据集 → `gatherTemplateData` 返回空 `resolvedVars` | ✅ 安全降级，judge systemPrompt 中的变量渲染为空（合理行为） |
| chat systemPrompt 未被误改 | 审查第 153 行 + 第 168、175 行 | ✅ chatSystemPrompt、tool schema 解析、buildDynamicTools 仍使用 `templateData`（被评估 agent 数据），未受影响 |
| judgeSystemPrompt 全部使用点已覆盖 | `grep judgeSystemPrompt` 搜索全代码库 | ✅ 仅在 execute-case.ts 的第 336、386 行被使用，两处均已修改 |

### 结果
✅ 通过

所有边界变体表现正常，旧数据兼容无风险。

## 4. Regression Result（回归验证）

### 静态检查
- `make typecheck`：通过
- `make test`（eval 相关 8 文件 / 143 用例）：全部通过

### Blast Radius 区域验证
| 区域 | 修复报告声明 | 实际验证结果 |
|------|-------------|-------------|
| Eval 执行引擎（judge systemPrompt 渲染） | 直接影响 | ✅ 代码审查 + 143 个单元测试通过确认 |
| Eval run 创建 API（run + batch route） | 直接影响 | ✅ typecheck 通过，新字段正确写入 |
| Chat systemPrompt / tools 渲染 | 不影响 | ✅ 代码审查确认仍使用 `templateData`，未被修改 |
| Chat 路由（/api/chat） | 不影响 | ✅ 无任何修改涉及此模块 |
| Eval assertions / case 导入导出 / batch 聚合 | 不影响 | ✅ 无任何修改涉及这些模块 |

### 结果
✅ 通过

静态检查通过，Blast Radius 声明属实，无回归。

## 5. Verdict（裁定）

### 判决
✅ 合并

### 证据摘要
- **Reproduction**：代码审查确认 judge systemPrompt 现在使用 judge 自身的 templateData 渲染，缺陷路径已消除
- **Coherence**：Root Cause 分析正确，修复对症（独立 gather judge templateData），决策理由充分（快照原则 + 职责隔离）
- **Boundary**：旧 run 兼容（null 安全降级）、judge 无数据集场景安全、chat 数据流未受影响、所有 judge 使用点已覆盖
- **Regression**：typecheck 通过 + 143 个 eval 测试通过 + blast radius 区域无回归

### 残留风险
- Schema 变更需要在合入 dev/main 后执行 `make db-generate` 生成迁移文件

## 过程备注

[确认] 修复报告声称的"不影响"区域（chat 路由、agent 构建页面等）经代码审查确认属实——修改范围严格限定在 eval 执行引擎的 judge 渲染路径
