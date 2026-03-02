# 集成报告：4 项 P0 测试/功能任务 + 基础设施增强

> 生成时间：2026-03-02 23:30
> 分支：`dev` → `main`
> 包含任务：4 个（4 个需求）

## 1. Scope（范围）

### 时间跨度
从 `9f5ee39`（main HEAD）到 `9a6eae1`（dev HEAD），共 36 个 commit

### 包含的任务

| 任务 | 类型 | 优先级 | 标题 | Verdict | 工作区 |
|------|------|--------|------|---------|--------|
| test-unit-chat-persistence | todo | P0 | 单元测试：Chat 持久化层 | ✅ 合并 | 存在 |
| test-unit-agent-snapshot-import-export | todo | P0 | 单元测试：Agent 导入导出与快照 | ✅ 合并 | 存在 |
| test-unit-chat-execute-stream | todo | P0 | 单元测试：Chat 流式执行核心逻辑 | ✅ 合并 | 存在 |
| eval-result-show-tool-output | todo | P0 | 评估结果中展示工具调用输出 | ✅ 合并 | 存在 |

### 直接提交（非工作区）

| Commit | 类型 | 描述 |
|--------|------|------|
| fc9bc90 | fix | 链路编排技能补充 AskUserQuestion 工具权限 |
| 99939dc | fix | worktree 创建时清除 NODE_ENV 确保 devDependencies 安装 |
| 6b4a2d1 | chore | admin 标签筛选 + issue/todo 技能增加 tags 字段 + gitignore 清理 |
| b1697ad | docs | 更新平台定位描述，聚焦 FDE + 前沿 Agent 能力 |
| 1db7e2d | refactor | ship 流程简化为单 PR + 新增发布冲突解决技能 |
| a4d72f4 | refactor | ship 技能改用 regular merge 替代 squash merge |

## 2. Additions（增量）

### 新功能

- **Eval 结果工具输出展示**：评估运行结果中展示工具调用的实际输出内容（`result` 字段），FDE 可完整查看 Agent 推理链路和工具执行效果。涉及类型定义（`ChatMessage.toolCalls`）和 `ResultCard` 组件改造

### 测试覆盖增强

- **Chat 持久化层单元测试**：覆盖 `createSession`、`saveUserMessage`、`saveAssistantMessage`、`loadSessionMessages` 和并发写入安全性（N=10 原子递增验证），共 12 项验收标准全部通过
- **Agent 导入导出与快照单元测试**：覆盖 `buildSnapshot`（19 个并行查询）、`restoreSnapshot`（多表事务恢复）、`copy-resources`（资源复制完整性）和 import 路由（含鉴权守护），共 31 个测试
- **Chat 流式执行核心逻辑单元测试**：覆盖工具三源发现（DB + MCP + Host）、Memory/RAG 注入、模板渲染、压缩触发、消息持久化时序和错误处理，共 24+ 个测试

### 安全增强（来自已合并 PR 的增量）

- **版本 publish/rollback 所有权检查**：版本操作增加 agent ownership 校验
- **Tool/Function test 端点鉴权**：`/api/tools/test` 和 `/api/functions/test` 增加 `requireAgentRole` 校验，需传入 `agentId`
- **Import 路由改造**：改为先上传 ZIP 到 Vercel Blob 再导入，绕过 4.5MB body 限制，增加 `maxDuration=60`
- **Wiki 数据隔离**：`tool-context.ts` 增加 `agentId` 过滤，防止跨 Agent wiki 数据泄漏
- **Dataset 查询 versionId 过滤**：dataset 查询增加 `versionId` 条件，防止跨版本数据混入

### 基础设施

- **Worktree 脚本重写**：从 shell 脚本迁移到 Node.js（`scripts/worktree/`），增加单元测试
- **Admin 面板**：Next.js 15 + React 19 管理面板（`scripts/admin/`），支持任务管理、报告查看、工作区操作
- **技能体系重构**：新增 15+ 技能（accept、archive、cap-guard、fix、implement、integrate、release 等），删除 5 个废弃技能
- **Version diff 查看器**：版本间差异对比功能（`version-diff-sheet.tsx`）
- **发布流程**：ship/integrate/release/archive/release-notes 完整发布链路

### 其他变更

- 链路编排技能补充 AskUserQuestion 工具权限
- worktree 创建时清除 NODE_ENV 确保 devDependencies 安装
- admin 标签筛选 + issue/todo 技能增加 tags 字段
- 平台定位文档更新

## 3. Breaking（破坏性变更）

### Schema 变更
- **无** — `web/src/db/schema.ts` 和 `drizzle/` 无变更

### API 变更
- **Tool test 端点**：新增必传参数 `agentId`（`/api/tools/test`）
- **Function test 端点**：新增必传参数 `agentId`（`/api/functions/test`）
- **Import 路由**：从直接上传 ZIP body 改为先上传到 Blob 再传 `blobUrl`（`/api/agents/import`）
- **新增 Upload 端点**：`/api/agents/import/upload`（Vercel Blob client upload）
- **新增 Diff 端点**：`/api/agents/[id]/versions/diff`（版本差异对比）

### 导出格式变更
- **无** — 无迁移文件变更

### 行为变更
- Tool/Function test 端点现在需要鉴权，未传 `agentId` 将返回 400
- Import 流程改为两步（upload → import），前端需适配
- Eval 结果卡片现在会展示工具调用输出（新增 UI 区域）

## 4. Risk（风险）

### 跨功能交互
- **低风险**：4 个工作区任务相互独立——3 个纯测试任务不修改业务代码，eval-result-show-tool-output 仅影响 eval 结果展示组件和类型定义
- **安全增强 + Import 改造**：版本操作鉴权和 import 流程改造涉及多个 API 端点，但已有对应守护测试覆盖

### 未闭合的缺口
- **snapshot mock 限制**：`restoreSnapshot` 测试中 drizzle `.returning()` mock 无法完全模拟真实行为（声明为 Known Gap，不影响功能正确性）
- **Import 路由两个 Known Gap**：版本标记回退（无 isEditing 时）和 ZIP 文件缺失跳过场景未测试，mock 复杂度高
- **历史 eval 数据无 result**：旧 eval 运行数据保存时未含 tool result 字段，仅影响历史数据展示

### 已知技术债务
- 6 个 DB 依赖测试（`partial-unique-index.test.ts` + `seed-idempotency.test.ts`）需要运行中的数据库才能通过，与本次改动无关

## 变更统计
- 文件数：254
- 新增行：+31,577
- 删除行：-3,902
