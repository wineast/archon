---
name: integrate
description: 集成报告。当用户说"集成"、"integrate"、"汇总变更"、"准备发布"、"dev 到 main"等时调用。扫描 merged 任务及工作区报告，分析 git diff，生成集成报告。
allowed-tools: AskUserQuestion, Read, Grep, Glob, Task, Bash, Write
---

扫描 merged 任务 + 工作区报告 + 分析 git diff → 聚合四元素 → 生成集成报告。

## 核心理念

需求链路的起点是 REQ.md（委托书），缺陷链路的起点是 DEFECT.md（起诉书），集成链路的起点是 INTEGRATE.md（货运清单）。

集成报告是这次"发货"的完整清单——不是简单的 git log 复制粘贴，而是从 merged 任务的工作区报告中提炼结构化信息，让发布检查有据可依。

### 三条链路的角色

```
需求链路  ──→  REQ.md → IMPL_REPORT → ACCEPT_REPORT  ──→  单功能交付
缺陷链路  ──→  DEFECT.md → FIX_REPORT → VERIFY_REPORT ──→  单缺陷修复
集成链路  ──→  INTEGRATE.md → RELEASE_REPORT           ──→  批量发布
```

集成链路将散落的工作区报告聚合，从"单个交付物合格"升级到"整批交付物可发布"。

### 任务与工作区的关系

```
todo/*.md  ──(status: merged)──→  .worktrees/{worktree}/.worktree/  ──→  需求链路报告
issues/*.md ──(status: merged)──→  .worktrees/{worktree}/.worktree/ ──→  缺陷链路报告
                                                                         ↓
                                                          聚合 → INTEGRATE.md
```

### 四不可约元素（集成种子）

| 元素 | 含义 | 来源 |
|-----|------|-----|
| **Scope** (范围) | 本次集成包含哪些变更 | merged 任务 + git log main..dev |
| **Additions** (增量) | 新功能 + 缺陷修复 | REQ.md 的 What + DEFECT.md 的 Delta |
| **Breaking** (破坏性变更) | 现有行为的改变 | Change Set 交叉分析 + schema 变更 |
| **Risk** (风险) | 跨功能交互、未覆盖区域 | Known Gaps 聚合 + Follow-up 聚合 |

## Phase 0: 扫描 merged 任务

### 目标
从 `todo/` 和 `issues/` 目录中找出所有 `status: merged` 的任务，定位其工作区和报告。

### 操作

1. **扫描任务文件**
   ```bash
   # 找出所有 merged 任务
   grep -rl "status: merged" todo/ issues/
   ```
   解析每个匹配文件的 YAML frontmatter，提取：
   - `type`：todo（需求）/ issue（缺陷）——由所在目录决定
   - `id`：文件名去掉 `.md`
   - `title`：文件内第一个 `#` 标题
   - `priority`：P0-P3
   - `worktree`：关联的工作区名称

2. **定位工作区报告**
   对每个 merged 任务，按 `worktree` 字段查找报告目录：
   ```
   .worktrees/{worktree}/.worktree/
   ```

   **两种情况**：
   - **工作区存在**：读取 `.worktree/` 下的报告文件
   - **工作区已删除**：标记为"工作区已清理"，仅从任务文件和 git log 提取信息

3. **按链路类型分类**
   根据报告文件存在情况判断：
   - 有 `DEFECT.md` → 缺陷链路
   - 有 `REQ.md` → 需求链路
   - 都没有 → 未归类（仅从任务文件提取）

4. **提取 Verdict**
   - 需求链路：读取 `ACCEPT_REPORT.md` 的 Verdict 部分
   - 缺陷链路：读取 `VERIFY_REPORT.md` 的 Verdict 部分
   - 无验收/验证报告 → 标记为"未验收/未验证"

5. **输出扫描结果**
   向用户报告：
   - 发现了多少个 merged 任务
   - 各自的类型、标题、Verdict
   - 哪些工作区仍存在，哪些已删除

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
   - 收集所有 merged 任务的工作区名称列表
   - 对比 commit 列表（squash merge commit 通常包含工作区名称，如 `feat({worktree-name}): squash merge from ...`）
   - 不属于任何工作区的 commit（如 chore、refactor）单独列出

5. **导出格式迁移版本碰撞检测**
   ```bash
   # 检查是否有多个 commit 修改了迁移注册文件
   git log main..dev --oneline -- 'web/src/lib/versions/migrations/index.ts'
   ```
   - 如果多个 commit（来自不同工作区）都修改了 `index.ts`（递增 `CURRENT_EXPORT_VERSION`），可能存在版本号碰撞
   - 并行工作区各自创建不同文件名的迁移文件（如 `0003_add_foo.ts` 和 `0003_add_bar.ts`），git 不报冲突，但两个迁移都声明 `fromVersion=2→toVersion=3`，导致迁移链断裂
   - 检测方法：读取 `web/src/lib/versions/migrations/index.ts`，检查是否有多个迁移声明相同的 `fromVersion`
   - 碰撞时在 Breaking 中标注为 ⚠️ 需修复，在 Risk 中列为发布阻塞项

## Phase 2: 聚合四元素

### 目标
从 merged 任务的工作区报告和 git 分析中提取并聚合四个不可约元素。

### 操作

#### 2.1 Scope（范围）
- 时间跨度：从 main 分支末尾 commit 到 dev HEAD
- 工作区清单：名称 + 类型(todo/issue) + 优先级 + 标题 + Verdict
- 非工作区 commit：chore、refactor 等

#### 2.2 Additions（增量）
- **新功能**（todo 类型）：
  - 工作区存在：从 `REQ.md` 提取 What 中的核心能力声明
  - 工作区已删除：从任务文件内容和 squash merge commit message 提取
- **缺陷修复**（issue 类型）：
  - 工作区存在：从 `DEFECT.md` 提取 Delta（期望行为 vs 实际行为）
  - 工作区已删除：从任务文件的 Symptom/Hypothesis 和 commit message 提取
- **其他变更**：从非工作区 commit 的 commit message 归类

#### 2.3 Breaking（破坏性变更）
- **Schema 变更**：`git diff main..dev -- 'web/src/db/schema.ts' 'drizzle/'` 是否有修改
- **API 变更**：`git diff main..dev -- 'web/src/app/api/'` 是否有接口变更
- **导出格式迁移**：`git diff main..dev -- 'web/src/lib/versions/migrations/' 'web/src/lib/versions/types.ts'` 是否有变更（迁移文件新增 / `CURRENT_EXPORT_VERSION` 递增 / snapshot 类型定义修改）
  - **版本碰撞检测**：如果 Phase 1 步骤 5 发现多个工作区 commit 都修改了 `index.ts`，检查迁移链是否断裂——两个迁移文件声明相同的 `fromVersion`，或 `CURRENT_EXPORT_VERSION` 被多次递增到相同值。碰撞时标注为 ⚠️ 需在 dev 上重排序修复后才能发布
- **行为变更**：从各工作区报告的 Constraint / Breaking Changes 聚合

#### 2.4 Risk（风险）
- **跨功能交互**：分析不同工作区的变更是否可能交互影响（如同时修改了同一模块的不同方面）
- **未闭合的缺口**：从各 `ACCEPT_REPORT.md` / `VERIFY_REPORT.md` 的 Follow-up / 残留风险聚合
- **已知技术债务**：从各 Known Gaps / 残留风险聚合

## Phase 3: 生成集成报告

### 输出位置

**固定写入 `.worktree/INTEGRATE.md`**。

### 报告模板

```markdown
# 集成报告：{一句话摘要}

> 生成时间：{YYYY-MM-DD HH:mm}
> 分支：`dev` → `main`
> 包含任务：{N} 个（{需求} 个需求 + {缺陷} 个修复）

## 1. Scope（范围）

### 时间跨度
从 `{base commit}` 到 `{head commit}`，共 {N} 个 commit

### 包含的任务

| 任务 | 类型 | 优先级 | 标题 | Verdict | 工作区 |
|------|------|--------|------|---------|--------|
| {id} | issue | P0 | {标题} | ✅ 合并 | 存在 |
| {id} | todo | P1 | {标题} | ✅ 合并 | 已清理 |

### 直接提交（非工作区）
{列出不属于任何工作区的 commit，如 chore、refactor 等}

## 2. Additions（增量）

### 新功能
{从各 todo 的 REQ.md What 或任务文件提取}
- **{功能名}**：{一句话描述核心能力}

### 缺陷修复
{从各 issue 的 DEFECT.md Delta 或任务文件提取}
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
{从各 ACCEPT_REPORT / VERIFY_REPORT 的 Follow-up / 残留风险聚合}

### 已知技术债务
{从各 Known Gaps / 残留风险 聚合}

## 变更统计
{git diff main..dev --stat 的摘要}
- 文件数：{N}
- 新增行：+{N}
- 删除行：-{N}
```

### 报告自检清单

- [ ] **Scope**：所有 merged 任务都扫描到了吗？非工作区 commit 列出来了吗？
- [ ] **Additions**：每个任务的核心变更都提取了吗？工作区已删除的有 fallback 吗？
- [ ] **Breaking**：Schema、API、导出格式、行为变更都检查了吗？
- [ ] **Risk**：跨功能交互分析了吗？未闭合缺口汇总了吗？

### 流程

1. 执行 Phase 0-2，收集所有信息
2. 生成报告内容，展示给用户
3. 用 `AskUserQuestion` 确认报告是否准确、是否需要补充
4. 确认后写入 `.worktree/INTEGRATE.md`
5. 告知用户报告位置，并提示后续操作：`/release`

## 执行规则

1. **任务驱动**：以 `status: merged` 的任务为起点，不是直接扫目录
2. **报告优先**：工作区存在时优先从报告提取信息；工作区已删除时从任务文件 + git log fallback
3. **Verdict 必须核对**：每个任务对应工作区的 Verdict 状态必须明确——未验收/未验证的要标注
4. **非工作区 commit 不能遗漏**：chore、refactor 等直接在 dev 上的 commit 也要纳入 Scope
5. **Breaking 必须检测**：Schema 和 API 变更是发布的硬约束，不能跳过
6. **Risk 必须交叉分析**：不同工作区的变更可能相互影响，不能孤立看待
7. **用户确认**：报告生成后必须用 `AskUserQuestion` 确认再写入

## 工作区报告路径参考

```
.worktrees/{worktree-name}/.worktree/
├── TASK.md                          # 任务定义（从主仓库复制的快照）
├── meta.json                        # 端口等元数据
│
├── ─── 需求链路（todo 类型）───
├── REQ.md                           # 需求报告
├── IMPL_REPORT.md                   # 实现报告
├── ACCEPT_REPORT.md                 # 验收报告（Verdict 源）
├── CAP_GUARD.md                     # 守护规约（可选）
├── CAP_GUARD_REPORT.md              # 守护报告（可选）
│
├── ─── 缺陷链路（issue 类型）───
├── DEFECT.md                        # 缺陷报告
├── FIX_REPORT.md                    # 修复报告
├── VERIFY_REPORT.md                 # 验证报告（Verdict 源）
├── TEST_GUARD.md                     # 守护规约（可选）
└── TEST_GUARD_REPORT.md              # 守护报告（可选）
```

## 与其他技能的协作

- **完整链条**：`/integrate` → 集成报告 → `/release` → 发布检查 → PR → 合并
- **上游依赖**：任务必须已完成各自链路并已合并到 dev（`status: merged`）
- **下游消费**：`/release` 读取 INTEGRATE.md 作为发布检查的输入
