---
name: implement
description: 需求实现。当用户说"实现"、"implement"、"按需求做"、"开始开发"、"做这个功能"等时调用。读取需求报告，设计方案、实现代码、自测，生成实现报告。
allowed-tools: AskUserQuestion, Read, Grep, Glob, Task, Bash, Write, Edit, mcp__playwright__*
---

读取需求报告 → 方案设计 → 代码实现 → 自测验证 → 生成实现报告。

## 核心理念

修复是复原——把偏离的轨道拉回来。实现是创造——在空地上盖一栋楼。

修复报告的灵魂是 Root Cause（为什么坏了），实现报告的灵魂是 Solution Design（怎么造的）。一个是回溯性的（向后看），一个是构建性的（向前看）。

### 与修复报告的结构对比

```
修复报告                         实现报告
────────                         ────────
Root Cause (根因)      ←→       Solution Design (方案)
  回溯性："为什么坏了"             构建性："造了什么"

Rationale (决策)       ←→       Design Rationale (设计决策)
  窄："为什么这样修"               宽："为什么这样设计"

Change (变更)          ←→       Change Set (变更集)
  局部手术                        系统工程

Blast Radius (波及)    ←→       Known Gaps (已知缺口)
  无意的副作用                     有意的取舍

Verification (验证)    ←→       Traceability (需求追溯)
  1:1 映射                        多对多映射
```

核心差异的根源：修复是在已知空间中操作（系统已存在，缺陷已定位），实现是在创造空间中操作（方案要设计，权衡要做出）。

### 链路中的位置：承上启下

```
需求报告                 实现报告                  验收报告
────────                 ────────                  ────────
Who (主体)      ──→    Solution Design 中的      ──→  场景走查
                        用户流程

Why (动机)      ──→    Design Rationale 的       ──→  动机满足度
                        决策锚点

What (能力)     ──→    Traceability 中的         ──→  能力逐项核对
                        需求覆盖映射

Acceptance      ──→    Traceability 中的         ──→  验收清单 ✓/✗
                        验证方式

Constraint      ──→    Traceability 中的         ──→  约束逐项确认
                        约束合规列
```

实现报告是需求报告和验收报告之间的翻译层——把需求方的"我要什么"翻译成验收方可检验的"这里有什么"。

## Phase 0: 读取需求报告

### 操作

1. 读取 `.worktree/REQ.md`，提取五要素：
   - **Who**：使用者、使用场景
   - **Why**：痛点、价值、不做的代价
   - **What**：核心能力声明、Out of Scope
   - **Acceptance**：验收标准清单
   - **Constraint**：业务约束、技术约束、不可打破的现有行为

2. 如果 `REQ.md` 不存在，用 `AskUserQuestion` 提示用户先运行 `/requirement`

3. 向用户简要复述需求要点，确认理解正确后进入设计

## Phase 1: 方案设计

### 目标
基于需求报告的五要素，设计具体的实现方案。这是实现链路中最核心的智力活动——从无限解空间中选择一个具体解。

### 操作

1. **深度代码调研**
   - 按需求报告的"参考"部分逐个 `Read` 涉及文件
   - 使用 `Task`（subagent_type=Explore）调研相关模块
   - 理解现有架构、数据流、交互模式

2. **设计方案**（Solution Design 三层）
   - **用户怎么用**：操作流程、交互方式（从 Who 的视角）
   - **系统怎么工作**：架构、数据流、模块关系
   - **关键界面/接口**：UI 布局、API 契约、数据结构

3. **决策记录**（Design Rationale）
   - 对每个关键设计决策，构思 2-3 个候选方案
   - 选择最优方案，记录选择依据
   - 记录被排除的方案及原因

4. **向用户确认方案**
   - 用 `AskUserQuestion` 展示方案要点，让用户确认或修正
   - 重点确认：用户流程是否符合 Who 的使用习惯、是否有遗漏的 Constraint

## Phase 2: 代码实现

### 目标
按确认的方案实施代码变更。

### 操作

1. **按模块/层次有序实现**
   - 先底层（数据模型、API）→ 再上层（组件、页面）
   - 每实现一个模块，记录：文件路径、新增/修改内容、服务于哪条 What

2. **编码规范**
   - 遵循项目约定（CLAUDE.md）
   - 用 `Edit` 修改代码，保持最小化变更
   - 新增文件用 `Write`，避免不必要的文件创建

3. **过程中构建 Traceability**
   - 每完成一个功能点，记录它对应需求报告的哪条 What/Acceptance/Constraint
   - 发现无法实现的需求项，立即记录到 Known Gaps

4. **静态检查**
   ```bash
   make typecheck
   make test
   ```
   - 如果失败，修复引入的问题后重新检查
   - 新增功能必须有对应的测试用例

## Phase 3: 自测验证

### 目标
用 Playwright 走一遍用户流程，确认功能可用；逐项核对 Acceptance 标准。

### 操作

#### 3.1 检查环境
检查 dev 服务器是否在运行：
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:{端口号} 2>/dev/null
```
如果存在 `.worktree/meta.json`，从中读取端口号；否则使用默认 3000。

如果未运行：`make up`（`run_in_background=true`），轮询等待就绪，**最多 15s**。超时则 `make down` + `make up` 重启，仍失败则报错给用户。

#### 3.2 功能验证（按 Solution Design 的用户流程走一遍）
1. 按设计的操作流程逐步操作
2. 关键步骤截图
3. 确认功能按预期工作

#### 3.3 Acceptance 逐项核对
1. 对照需求报告的 Acceptance 清单，逐项验证
2. 每项标记 ✓（通过）或 ✗（未通过）
3. 未通过的项记录原因，判断是实现缺陷还是 Known Gap

#### 3.4 Constraint 合规检查
1. 逐项确认 Constraint 未被违反
2. 检查现有行为是否保持不变

#### 3.5 截图命名
- `.worktree/IMPL_REPORT.assets/impl-{简述}-flow-{N}.png` — 用户流程截图
- `.worktree/IMPL_REPORT.assets/impl-{简述}-accept-{N}.png` — 验收项验证截图

## Phase 4: 生成实现报告

### 五个不可约元素

从验收者的认知需求反推，缺少任何一个都无法完成验收：

```
            实现报告
               │
      ┌────────┼────────┐
      │        │        │
 Solution   Design   Change
  Design   Rationale   Set
 (怎么造的)(为什么这样造)(改了什么)
      │        │        │
      └────────┼────────┘
               │
      ┌────────┴────────┐
      │                 │
 Traceability      Known Gaps
 (需求覆盖了吗)    (什么没做到)
```

1. **Solution Design（方案设计）**——"造了个什么东西"：用户视角的完整方案——操作流程、架构、交互方式。What 是合同条款，Solution Design 是施工图纸
2. **Design Rationale（设计决策）**——"为什么这样造"：每个关键设计决策的选择依据 + 被排除的替代方案 + 已知妥协。没有 Rationale 的代码是等待退化的代码
3. **Change Set（变更集）**——"在代码层面改了什么"：系统性工程，需结构化组织——按模块/层次/功能分组，而非全量 diff
4. **Traceability（需求追溯）**——"每条需求都有着落吗"：需求报告五要素与实现的多对多映射。价值不仅是展示"做了什么"，更是暴露"没做什么"
5. **Known Gaps（已知缺口）**——"什么没做到"：未实现项 + 已知限制 + 技术债务。缺口本身不可怕，隐瞒缺口才可怕

### 资源管理

所有实现产物统一放在 `.worktree/` 下：
```
.worktree/
├── REQ.md                            # 需求报告（输入）
├── IMPL_REPORT.md                    # 实现报告（输出）
└── IMPL_REPORT.assets/               # 实现截图
    ├── impl-{简述}-flow-{N}.png      # 用户流程截图
    └── impl-{简述}-accept-{N}.png    # 验收项验证截图
```

### 报告模板

```markdown
# 实现报告：{一句话标题}

> 实现时间：{YYYY-MM-DD HH:mm}
> 关联需求：[REQ.md](REQ.md)
> 分支：`{branch}`

## 1. Solution Design（方案设计）

### 用户流程
{从 Who 的视角描述操作路径——用户怎么用这个功能}
1. {步骤 1}
2. {步骤 2}
3. ...

### 系统架构
{架构、数据流、模块关系——系统怎么工作}

### 关键界面/接口
{UI 布局描述 / API 契约 / 数据结构}

## 2. Design Rationale（设计决策）

### 决策 1：{决策主题}
- **选择**：{最终方案}
- **替代方案**：{被排除的方案} — 不选原因：{原因}
- **选择依据**：{为什么选这个——性能/可维护性/架构一致性/工期}
- **已知妥协**：{此方案的不完美之处。无则写"无"}

### 决策 2：{决策主题}
{同上格式}

## 3. Change Set（变更集）

### 变更摘要
{用 1-3 句话概括逻辑上做了什么}

### 新增
| 文件 | 说明 |
|------|------|
| `path/to/new-file.ts` | {新增了什么，服务于哪条 What} |

### 修改
| 文件 | 改动 | 说明 |
|------|------|------|
| `path/to/file.ts` | {修改内容} | {为什么改这里} |

### 删除
| 文件 | 说明 |
|------|------|
| `path/to/old-file.ts` | {为什么删除} |

{无删除则省略此节}

### 配置变更
{数据库 schema、环境变量、依赖更新。无则省略此节}

## 4. Traceability（需求追溯）

| 需求项 | 类型 | 实现位置 | 状态 |
|--------|------|----------|------|
| {需求描述} | What | {文件/模块} | ✅ 已实现 |
| {验收标准} | Acceptance | {文件/模块} | ✅ 已验证 |
| {约束条件} | Constraint | {文件/模块} | ✅ 已满足 |
| {未实现项} | What | — | ❌ → Known Gaps |

## 5. Known Gaps（已知缺口）

### 未实现项
{需求报告中明确提到但未实现的 What/Acceptance，以及原因。无则写"无"}

### 已知限制
{实现了但有质量/性能/兼容性方面的已知不足。无则写"无"}

### 技术债务
{为了赶工期做的妥协，后续需要重构的部分。无则写"无"}

## 验证结果

### 静态检查
- `make typecheck`：{通过/失败}
- `make test`：{通过/失败，N 个用例}

### 功能验证
{按用户流程走一遍的结果}

| 步骤 | 截图 |
|------|------|
| {步骤描述} | ![flow](IMPL_REPORT.assets/impl-{简述}-flow-{N}.png) |

### Acceptance 核对
| # | 验收标准 | 结果 |
|---|----------|------|
| 1 | {Given..When..Then} | ✅ |
| 2 | {Given..When..Then} | ✅ |
| ... | ... | ... |

### Constraint 合规
| # | 约束 | 结果 |
|---|------|------|
| 1 | {约束描述} | ✅ 未违反 |
| ... | ... | ... |

## 过程备注

{执行过程中捕获的学习信号。无则留空}
```

### 报告自检清单

- [ ] **Solution Design**：用户流程清晰吗？验收者能在脑中建立画面吗？
- [ ] **Design Rationale**：每个关键决策都有替代方案对比吗？未来维护者知道"别删这段代码"吗？
- [ ] **Change Set**：按模块/层次组织了吗？非维护者能理解变更全貌吗？
- [ ] **Traceability**：需求报告的每条 What/Acceptance/Constraint 都有对应行吗？
- [ ] **Known Gaps**：有遗漏的未实现项吗？已知限制坦诚声明了吗？

### 流程

1. 生成报告内容，展示给用户
2. 用 `AskUserQuestion` 确认报告是否准确
3. 确认后写入 `.worktree/IMPL_REPORT.md`
4. 启动/更新报告查看器：
   ```bash
   node .claude/skills/shared/serve-req-chain.mjs
   # 用 Bash(run_in_background=true) 执行
   # 幂等：已有 viewer 进程运行时自动跳过，文件变化通过 SSE 自动刷新
   ```
5. 告知用户后续操作（如 `/accept` 验收、`/cap-guard` 守护等）

## 执行规则

1. **先读需求报告**：不要凭空实现，必须基于 REQ.md 的五要素
2. **方案先确认**：实现前必须向用户确认 Solution Design，不要闷头写代码
3. **Why 是锚点**：Design Rationale 中的每个决策都要回溯到需求报告的 Why
4. **边实现边追溯**：每完成一个功能点就更新 Traceability 映射，不要最后补
5. **坦诚 Known Gaps**：发现做不到的就立即记录，不要藏着掖着
6. **必须自测**：用 Playwright 走完用户流程 + 逐项核对 Acceptance
7. **静态检查不跳过**：`make typecheck` + `make test` 必须通过
8. **截图取证**：关键流程和验收项必须截图
9. **新功能必须有测试**：不能只让现有测试通过就算完成
10. **过程备注**：执行过程中遇到重试、惊讶、绕路、确认、环境等偏差信号时，记录到报告的「过程备注」节。格式：`[重试/惊讶/绕路/确认/环境] 简述`

## 与其他技能的协作

- **需求链路**：`/requirement` → 需求报告 → `/implement` → 实现报告 → 验收
- **缺陷链路**：`/diagnose` → 缺陷报告 → `/fix` → 修复报告 → `/verify` → 验证报告
- **典型流程**：`/create-wt` 创建工作区 → `/requirement` 定义需求 → `/implement` 实现 → `/pr-wt` 提交
- **独立使用**：如果需求明确，也可以手动创建 REQ.md 后直接 `/implement`
