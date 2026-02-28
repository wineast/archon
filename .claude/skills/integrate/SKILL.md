---
name: integrate
description: 集成报告。当用户说"集成"、"integrate"、"汇总变更"、"准备发布"、"dev 到 main"等时调用。扫描子工作区报告，分析 git diff，生成集成报告。
allowed-tools: AskUserQuestion, Read, Grep, Glob, Task, Bash, Write
---

扫描子工作区报告 + 分析 git diff → 聚合四元素 → 生成集成报告。

## 核心理念

需求链路的起点是 REQ.md（委托书），缺陷链路的起点是 DEFECT.md（起诉书），集成链路的起点是 INTEGRATE.md（货运清单）。

集成报告是这次"发货"的完整清单——不是简单的 git log 复制粘贴，而是从子工作区报告中提炼结构化信息，让发布检查有据可依。

### 三条链路的角色

```
需求链路  ──→  REQ.md → IMPL_REPORT → ACCEPT_REPORT  ──→  单功能交付
缺陷链路  ──→  DEFECT.md → FIX_REPORT → VERIFY_REPORT ──→  单缺陷修复
集成链路  ──→  INTEGRATE.md → RELEASE_REPORT           ──→  批量发布
```

集成链路将散落的子工作区报告聚合，从"单个交付物合格"升级到"整批交付物可发布"。

### 与子工作区报告的关系

```
子工作区报告                    集成报告
────────────                    ────────
各自的 What / Delta   ──聚合──→  Additions（增量清单）
各自的 Constraint     ──交叉──→  Breaking（破坏性变更）
各自的 Known Gaps     ──汇总──→  Risk（风险评估）
git log main..dev     ──分析──→  Scope（范围界定）
```

### 四不可约元素（集成种子）

| 元素 | 含义 | 来源 |
|-----|------|-----|
| **Scope** (范围) | 本次集成包含哪些变更 | sub-worktrees/ + git log main..dev |
| **Additions** (增量) | 新功能 + 缺陷修复 | REQ.md 的 What + DEFECT.md 的 Delta |
| **Breaking** (破坏性变更) | 现有行为的改变 | Change Set 交叉分析 + schema 变更 |
| **Risk** (风险) | 跨功能交互、未覆盖区域 | Known Gaps 聚合 + Follow-up 聚合 |

## Phase 0: 扫描子工作区

### 目标
遍历 `.worktree/sub-worktrees/`，识别每个子工作区的类型和状态。

### 操作

1. **列出子工作区目录**
   ```bash
   ls .worktree/sub-worktrees/
   ```

2. **按报告文件分类**
   - 有 `REQ.md` → 需求链路
   - 有 `DEFECT.md` → 缺陷链路
   - 两者都有 → 混合（先缺陷后需求，少见）
   - 都没有 → 未归类（记为"其他"）

3. **提取 Verdict**
   - 需求链路：读取 `ACCEPT_REPORT.md` 的 Verdict
   - 缺陷链路：读取 `VERIFY_REPORT.md` 的 Verdict
   - 无验收/验证报告 → 标记为"未验收/未验证"

4. **输出扫描结果**
   向用户报告发现了多少子工作区、各自的类型和 Verdict

## Phase 1: 分析 git

### 目标
从 git 历史中提取本次集成的完整变更范围。

### 操作

1. **Commit 历史**
   ```bash
   git log main..dev --oneline
   ```

2. **变更统计**
   ```bash
   git diff main..dev --stat
   ```

3. **关键区域检测**
   ```bash
   # Schema 变更
   git diff main..dev --name-only -- 'web/src/db/schema.ts' 'drizzle/'

   # API 变更
   git diff main..dev --name-only -- 'web/src/app/api/'

   # Guide 变更
   git diff main..dev --name-only -- 'web/guide/'
   ```

4. **识别非工作区 commit**
   - 对比 commit 列表和子工作区名称
   - 不属于任何子工作区的 commit（如 chore、refactor）单独列出

## Phase 2: 聚合四元素

### 目标
从子工作区报告和 git 分析中提取并聚合四个不可约元素。

### 操作

#### 2.1 Scope（范围）
- 时间跨度：从 main 分支末尾 commit 到 dev HEAD
- 工作区清单：名称 + 类型 + 标题 + Verdict
- 非工作区 commit：chore、refactor 等

#### 2.2 Additions（增量）
- **新功能**：从每个需求链路子工作区的 `REQ.md` 提取 What 中的核心能力声明
- **缺陷修复**：从每个缺陷链路子工作区的 `DEFECT.md` 提取 Delta（期望行为 vs 实际行为）
- **其他变更**：从非工作区 commit 的 commit message 归类

#### 2.3 Breaking（破坏性变更）
- **Schema 变更**：`git diff main..dev -- 'web/src/db/schema.ts' 'drizzle/'` 是否有修改
- **API 变更**：`git diff main..dev -- 'web/src/app/api/'` 是否有接口变更
- **导出格式变更**：是否影响 fixture 导入导出
- **行为变更**：从各子工作区报告的 Constraint / Breaking Changes 聚合

#### 2.4 Risk（风险）
- **跨功能交互**：分析不同工作区的变更是否可能交互影响（如同时修改了同一模块的不同方面）
- **未闭合的缺口**：从各 `ACCEPT_REPORT.md` / `VERIFY_REPORT.md` 的 Follow-up 聚合
- **已知技术债务**：从各 Known Gaps / 残留风险聚合

## Phase 3: 生成集成报告

### 输出位置

**固定写入 `.worktree/INTEGRATE.md`**。

### 报告模板

```markdown
# 集成报告：{一句话摘要}

> 生成时间：{YYYY-MM-DD HH:mm}
> 分支：`dev` → `main`
> 包含工作区：{N} 个（{需求} 个需求 + {缺陷} 个修复）

## 1. Scope（范围）

### 时间跨度
从 `{base commit}` 到 `{head commit}`，共 {N} 个 commit

### 包含的工作区

| 工作区 | 类型 | 标题 | Verdict |
|--------|------|------|---------|
| {name} | 需求 | {标题} | ✅ 合并 |
| {name} | 缺陷 | {标题} | ✅ 合并 |

### 直接提交（非工作区）
{列出不属于任何子工作区的 commit，如 chore、refactor 等}

## 2. Additions（增量）

### 新功能
{从各 REQ.md 的 What 提取}
- **{功能名}**：{一句话描述核心能力}

### 缺陷修复
{从各 DEFECT.md 的 Delta 提取}
- **{修复名}**：{一句话描述修复了什么}

### 其他变更
{chore、refactor 等非工作区的变更}

## 3. Breaking（破坏性变更）

### Schema 变更
{git diff main..dev -- 'web/src/db/schema.ts' 'drizzle/' 的结果}
- 有 / 无

### API 变更
{影响外部接口的变更}
- 有 / 无

### 导出格式变更
{影响 fixture 导入导出的变更}
- 有 / 无

### 行为变更
{从各报告的 Constraint / Breaking Changes 聚合}

## 4. Risk（风险）

### 跨功能交互
{分析不同工作区的变更是否可能交互影响}

### 未闭合的缺口
{从各 ACCEPT_REPORT / VERIFY_REPORT 的 Follow-up 聚合}

### 已知技术债务
{从各 Known Gaps / 残留风险 聚合}

## 变更统计
{git diff main..dev --stat 的摘要}
- 文件数：{N}
- 新增行：+{N}
- 删除行：-{N}
```

### 报告自检清单

- [ ] **Scope**：所有子工作区都扫描到了吗？非工作区 commit 列出来了吗？
- [ ] **Additions**：每个子工作区的核心变更都提取了吗？
- [ ] **Breaking**：Schema、API、导出格式、行为变更都检查了吗？
- [ ] **Risk**：跨功能交互分析了吗？未闭合缺口汇总了吗？

### 流程

1. 执行 Phase 0-2，收集所有信息
2. 生成报告内容，展示给用户
3. 用 `AskUserQuestion` 确认报告是否准确、是否需要补充
4. 确认后写入 `.worktree/INTEGRATE.md`
5. 告知用户报告位置，并提示后续操作：`/release`

## 执行规则

1. **扫描先行**：必须先遍历所有子工作区，不能只看 git log
2. **报告驱动**：优先从子工作区报告提取信息，git log/diff 作为补充和交叉验证
3. **Verdict 必须核对**：每个子工作区的 Verdict 状态必须明确——未验收/未验证的要标注
4. **非工作区 commit 不能遗漏**：chore、refactor 等直接在 dev 上的 commit 也要纳入 Scope
5. **Breaking 必须检测**：Schema 和 API 变更是发布的硬约束，不能跳过
6. **Risk 必须交叉分析**：不同工作区的变更可能相互影响，不能孤立看待
7. **用户确认**：报告生成后必须用 `AskUserQuestion` 确认再写入

## 与其他技能的协作

- **完整链条**：`/integrate` → 集成报告 → `/release` → 发布检查 → PR → 合并
- **上游依赖**：子工作区必须已完成各自链路（需求链路走完验收，缺陷链路走完验证）
- **下游消费**：`/release` 读取 INTEGRATE.md 作为发布检查的输入
