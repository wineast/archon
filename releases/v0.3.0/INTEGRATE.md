# 集成报告：Eval Run versionId 快照修复 + 配置漂移消除

> 生成时间：2026-03-02 18:30
> 分支：`dev` → `main`
> 包含任务：1 个（0 个需求 + 1 个修复）

## 1. Scope（范围）

### 时间跨度
从 `4fee2b3`（origin/main HEAD）到 `28575d1`（dev HEAD），共 3 个 commit

### 包含的任务

| 任务 | 类型 | 优先级 | 标题 | Verdict | 工作区 |
|------|------|--------|------|---------|--------|
| eval-run-versionid-drift | issue | P0 | Eval Run 执行时 versionId 实时解析导致配置漂移 | ✅ 合并 | 存在 |

### 直接提交（非工作区）

| Commit | 描述 | 影响 |
|--------|------|------|
| `437de8f` | feat: 技能链路强制 E2E 门禁 + 截图资产审计 | 已被 `28575d1` 完全 revert，**净变更为零** |
| `28575d1` | Revert "feat: 技能链路强制 E2E 门禁 + 截图资产审计" | 与上条互消 |

## 2. Additions（增量）

### 新功能
无

### 缺陷修复
- **Eval Run versionId 快照**：Run 创建时将 `versionId` 写入 `chatVersionId` 字段，case 执行时从 run 快照读取（而非实时查询 `agents.editingVersionId`），消除 eval 运行期间版本切换导致的 tools/templateData 与 systemPrompt 不一致问题。覆盖单次执行（`/api/eval/run`）和批量执行（`/api/eval/batch`）两条路径。

### 其他变更
无（feat/revert 互消）

## 3. Breaking（破坏性变更）

### Schema 变更
- **有**：`evalRuns` 表新增 `chatVersionId` 列（`uuid`, nullable）
  - 非破坏性：nullable 列不影响现有数据，旧 run 的 `chatVersionId` 为 null
  - ⚠️ 需生成 drizzle 迁移文件（`make db-generate`），当前仅有 schema 定义变更，无迁移文件

### API 变更
- **有（向后兼容）**：`POST /api/eval/run` 和 `POST /api/eval/batch` 返回的 run 记录新增 `chatVersionId` 字段。无破坏性，消费方无需修改。

### 导出格式变更
- 无

### 行为变更
- Case 执行不再实时查询 `agents.editingVersionId`，改为使用 run 创建时的快照值。对终端用户无感知影响。

## 4. Risk（风险）

### 跨功能交互
- 无。本次只有一个工作区变更，不涉及多模块交互。

### 未闭合的缺口
- **Judge agent versionId 未快照**：当前 judge 配置已作为 JSONB 全量快照（modelConfig + judgeConfig），影响较小。但如果 judge 未来需要加载版本化资源（如 tools/datasets），可能需要同样的 versionId 快照。（来源：VERIFY_REPORT.md 残留风险）

### 已知技术债务
- Judge versionId 快照（如上，低优先级）
- 需要在 dev 上运行 `make db-generate` 生成 drizzle 迁移文件

## 变更统计
- 文件数：8
- 新增行：+309
- 删除行：-8
- 核心代码变更：3 文件（schema.ts, execute-case.ts, run/route.ts + batch/route.ts）
- 新增测试：1 文件（execute-case-versionid.guard.test.ts, 300 行）
