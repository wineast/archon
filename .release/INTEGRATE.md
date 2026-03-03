# 集成报告：3 个 Eval P0 缺陷修复 + 基础设施优化

> 生成时间：2026-03-03 11:30
> 分支：`dev` → `main`
> 包含任务：3 个缺陷修复 + 2 个直接提交

## 1. Scope（范围）

### 时间跨度
从 `9a772a7`（Merge PR #28, v0.3.0）到 `f8a77d5`（HEAD），共 5 个 commit

### 包含的任务

| 任务 | 类型 | 优先级 | 标题 | Verdict | 工作区 |
|------|------|--------|------|---------|--------|
| eval-batch-judge-config-snapshot-missing-fields | issue | P0 | Batch 模式 judgeConfigSnapshot 丢失 promptTemplate/turnPromptTemplate | 合并 | 存在 |
| eval-judge-system-prompt-uses-wrong-template-data | issue | P0 | Judge systemPrompt 渲染使用被评估 agent 的 templateData | 合并 | 存在 |
| eval-run-config-snapshot-no-transaction | issue | P0 | Eval Run 创建时配置查询非事务性，存在读取不一致窗口 | 合并 | 存在 |

### 直接提交（非工作区）

| Commit | 说明 |
|--------|------|
| `68880f2` | chore: worktree 删除时自动清理关联分支，移除报告归档（`scripts/worktree/cmd/delete.mjs`） |
| `69023b7` | chore: 仅构建 main 分支，跳过 dev/worktree 的 Vercel 构建（`web/vercel.json`） |

## 2. Additions（增量）

### 缺陷修复

- **Batch judgeConfigSnapshot 补全**：batch/route.ts 创建 per-run 记录时遗漏了 `promptTemplate` 和 `turnPromptTemplate` 两个字段，导致 batch 模式下自定义 judge 模板被静默忽略。现已补全，与 run/route.ts 对齐。
- **Judge templateData 隔离**：execute-case.ts 只为被评估 agent 收集 templateData，judge agent 的 systemPrompt 渲染错误地复用了被评估 agent 的数据，导致 judge 独有变量解析为空。修复后为 judge agent 单独调用 `gatherTemplateData`，schema 新增 `judgeVersionId` 列用于快照 judge 版本。
- **配置快照事务化**：run/route.ts 和 batch/route.ts 的 5 次配置查询（agent modelConfig、judge modelConfig、judgeConfig 等）从独立 `db.select()` 改为 `db.transaction({ isolationLevel: "repeatable read" })` 包裹，确保快照读取原子性。错误处理从 `return Response.json()` 改为 `throw ConfigError` + 外层 catch。

### 其他变更

- worktree 删除脚本自动清理关联的 git 分支
- Vercel 构建配置跳过 dev/worktree 分支

## 3. Breaking（破坏性变更）

### Schema 变更
- **有**：`evalRuns` 表新增 `judgeVersionId: uuid("judge_version_id")` 列（nullable，向后兼容）
- 迁移文件已生成：`drizzle/0007_odd_frank_castle.sql`

### API 变更
- **无**：eval batch/run POST 接口的请求/响应格式未变，内部实现优化

### 导出格式变更
- **无**

### 行为变更
- **无破坏性行为变更**：所有修复都是 bug fix，修正了原本不正确的行为

## 4. Risk（风险）

### 跨功能交互
3 个修复都涉及 eval 模块的配置快照流程，存在高度重叠：
- `batch/route.ts` 被 3 个 commit 同时修改
- `run/route.ts` 被 2 个 commit 同时修改
- **已验证**：通过逐 commit diff 对比和源码审查，确认三个修改完整保留、协同正确（详见本次集成前的代码审查）

### 未闭合的缺口
- **Batch existingRunningBatch 竞态**：并发检查仍在事务外，存在 TOCTOU 竞态（独立缺陷，不影响本次修复目标）

### 已知技术债务
- 旧 run 记录 `judgeVersionId=null`，execute-case 已做兼容处理（fallback 到不单独 gather judge templateData）

## 变更统计
- 文件数：15
- 新增行：+1,152
- 删除行：-227
- 主要构成：6 个新增守护测试文件（~900 行）+ 3 个 route/execute-case 修改 + schema 1 行
