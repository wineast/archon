---
name: cap-guard
description: 需求守护。当用户说"需求守护"、"能力守护"、"cap guard"、"写守护测试"、"需求测试"、"守护规约"等时调用。读取需求链路三份报告，生成需求守护规约，编写并执行测试代码，启动 HTML 预览。
allowed-tools: AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, Skill, mcp__playwright__*
---

读取需求链路三份报告 → 生成需求守护规约 → 编写测试代码 → 执行验证 → 生成守护报告 → 启动 HTML 预览。

## 核心理念

验证/验收是一次性人工判定，测试是永久性自动守卫。

验证/验收证明"现在好了"，测试保证"以后也好"。

需求守护知道"什么应该是对的"——来自一份契约（验收标准），而非一次事故。保护的是**一个面**（整体能力不退化），而非一个点（特定 bug 不复发）。

### 需求守护的灵魂：水平双层防护

```
缺陷守护的双层：           需求守护的双层：
  ┌─── 症状层（用户看到的）    ┌─── 标准层（每条标准独立验）
  └─── 根因层（代码机制的）    └─── 旅程层（标准串起来走通）
```

标准全过 ≠ 功能可用。标准是离散的检查点，用户体验是连续的旅程——每个检查点都过了，连起来走一遍可能不通顺。

### 与缺陷守护的终极对照

```
缺陷守护                          需求守护
──────                            ──────
Invariant (不变量)        ←→     Capability (能力宣言)
  一个点的否定式守护                一个面的肯定式守护

Trigger Scenario (触发)   ←→     Criteria Matrix (标准矩阵)
  1 条路径，追求深度                N 条标准，追求广度

Cause Anchor (根因锚点)   ←→     Journey Test (旅程测试)
  【缺陷独有】垂直钻              【需求独有】水平串

Boundary Set (边界集)     ←→     Constraint Guard (约束守卫)
  同一 bug 的输入变体              业务红线的否定断言

Blast Shield (防爆盾)     ←→     Degradation Fence (退化围栏)
  修复的副作用防护                  已知缺口的底线防护
```

### 链路中的位置

```
需求报告 → 实现报告 → 验收报告 → 守护规约 → 测试代码
                                      ↓
                                   守护报告
```

测试规约是人工判定到自动守卫的翻译层。

## Phase 0: 读取输入报告

### 操作

1. 读取 `.worktree/REQ.md`，提取：
   - **Who**：使用者、使用场景
   - **What**：核心能力声明
   - **Acceptance**：验收标准清单
   - **Constraint**：业务约束、技术约束

2. 读取 `.worktree/IMPL_REPORT.md`，提取：
   - **Solution Design**：用户流程、系统架构
   - **Change Set**：新增/修改的文件
   - **Known Gaps**：已知限制

3. 读取 `.worktree/ACCEPT_REPORT.md`，提取：
   - **Criteria Verdict**：每条标准的验证结果
   - **Experience Validation**：用户旅程、四维度评估
   - **Gap Assessment**：缺口评估结果

4. 如果任一文件不存在，提示用户先运行对应技能

5. 向用户简要复述三份报告要点，进入规约生成

## Phase 1: 生成需求守护规约

### 五个不可约元素

```
             需求守护规约
                  │
          ┌───────┼───────┐
          │       │       │
    Capability  Criteria  Journey
     (守什么)    Matrix     Test
               (逐条验)   (串着走)
          │       │       │
          └───────┼───────┘
                  │
          ┌───────┴───────┐
          │               │
    Constraint      Degradation
      Guard           Fence
     (红线守)        (底线守)
```

### 1.1 Capability（能力宣言）

从需求报告的 What + Why 推导：
- What："用户能按类型筛选列表"
- Why："因为数据太多找不到目标"
- **Capability**："列表筛选能力：用户能通过类型筛选快速定位目标数据"

一份守护规约对应一个 Capability。大需求可拆成多个 Capability，每个独立一份规约。

### 1.2 Criteria Matrix（标准矩阵）

将需求报告的每条 Acceptance 标准转化为 Given/When/Then：

```
验收标准 AC-1："选择类型 A 后，列表只显示类型 A 的条目"
  → Given: 列表中有类型 A/B/C 各若干条目
    When:  选择筛选类型 A
    Then:  列表只显示类型 A 的条目
    Level: Integration/E2E
    Boundaries:
      - 无匹配项 → 显示空状态
      - 仅 1 条匹配 → 正常显示
```

每条标准至少一个核心测试场景，有隐含边界时展开。

### 1.3 Journey Test（旅程测试）

**需求守护独有元素**。模拟用户的完整使用旅程，测试标准之间的衔接。

两个来源：
- **验收报告的 Experience Validation**：验收者走过的完整旅程
- **需求报告的 Who 场景推导**：用户角色的典型工作流

Journey Test 一定是 E2E 层级。通常 1-3 个：
- Happy Path Journey（必须有）
- Alternative Journey（备选流程）
- Recovery Journey（异常恢复，如有）

### 1.4 Constraint Guard（约束守卫）

测否定性断言——"什么不应该发生"：

```
约束："对比是只读操作"
  → Given: 执行版本对比
    When:  对比完成
    Then:  两个版本的数据无任何变更
```

来源：需求报告的 Constraint + 验收报告的 Constraint 合规验证。

### 1.5 Degradation Fence（退化围栏）

防止 Known Gaps 中的已知局限进一步恶化：

```
Known Gap: "导出只支持 CSV"
  → Degradation Fence: CSV 导出必须持续工作
  → 如果 CSV 也坏了，就是跌破底线
```

来源：实现报告的 Known Gaps + 验收报告的 Gap Assessment。

### 1.6 Level 决策

```
Guard 涉及纯逻辑（计算、转换、校验）→ 单元测试
Guard 涉及模块间交互（API调用、数据流）→ 集成测试
Guard 涉及用户可见行为（页面、流程）  → E2E 测试
```

需求测试通常跨多个层级——一个需求可能需要单元测试验逻辑 + 集成测试验 API + E2E 验完整流程。

### 操作

1. 基于三份报告推导五个元素
2. 生成完整的守护规约文档
3. 用 `AskUserQuestion` 向用户确认规约是否准确
4. 确认后进入代码实现

## Phase 2: 编写测试代码

### 操作

#### 2.1 调研测试基础设施

- 扫描已有测试（`__tests__/`、`web/e2e/`、`.stories.tsx`）
- 了解 mock 方式、fixture、helper 模式
- 读取 Change Set 中的文件，理解待测逻辑

#### 2.2 按金字塔分层编写

**单元测试（Vitest + Testing Library）**：
- Criteria Matrix 中 Level=Unit 的条目
- Constraint Guard 中 Level=Unit 的条目
- Degradation Fence 中 Level=Unit 的条目
- 文件放在对应模块的 `__tests__/` 下
- 参考同目录已有测试的模式

**集成测试（Vitest）**：
- Criteria Matrix 中 Level=Integration 的条目
- Constraint Guard 中 Level=Integration 的条目
- 文件放在对应模块的 `__tests__/` 下

**E2E 测试（Playwright）**：
- Journey Test（必须 E2E）
- Criteria Matrix 中 Level=E2E 的条目
- 文件放在 `web/e2e/` 下
- **先用 Playwright MCP 手动走一遍确认选择器**，再写测试代码
- 遵循 CLAUDE.md 中 E2E 测试约定

#### 2.3 编写规范

- 每个测试用例对应规约中的一个条目（Traceability）
- 测试描述用中文，与规约中的 Guard/Scenario 对应
- `test.step()` 结构化步骤
- 充分的 log 输出

### 2.4 静态检查

```bash
make typecheck
make test
```

如有 E2E 测试：
```bash
make e2e
```

修复引入的问题后重新检查。

## Phase 3: 生成守护报告 + 启动预览

### 资源管理

```
.worktree/
├── REQ.md                           # 需求报告（输入）
├── IMPL_REPORT.md                   # 实现报告（输入）
├── ACCEPT_REPORT.md                 # 验收报告（输入）
├── CAP_GUARD.md                     # 守护规约（输出）
├── CAP_GUARD_REPORT.md              # 守护报告（输出）
└── CAP_GUARD_REPORT.assets/         # 截图（如有 E2E）
```

### 守护规约模板（CAP_GUARD.md）

```markdown
# 需求守护规约：{一句话标题}

> 生成时间：{YYYY-MM-DD HH:mm}
> 关联需求：[REQ.md](REQ.md)
> 关联实现：[IMPL_REPORT.md](IMPL_REPORT.md)
> 关联验收：[ACCEPT_REPORT.md](ACCEPT_REPORT.md)
> 分支：`{branch}`

## 1. Capability（能力宣言）

{一段话描述保护什么能力不退化}

## 2. Criteria Matrix（标准矩阵）

| # | 验收标准 | Given | When | Then | Level | Boundaries |
|---|----------|-------|------|------|-------|------------|
| 1 | {AC-1} | {前置} | {操作} | {断言} | Unit/Integration/E2E | {边界变体} |

## 3. Journey Test（旅程测试）

### Journey 1: {旅程名}
- **Who**: {用户角色}
- **Level**: E2E
- **Flow**:
  1. {步骤 1}
  2. {步骤 2}
  3. ...
- **关键断言**: {串联过程中的核心验证点}

## 4. Constraint Guard（约束守卫）

| # | 约束 | Given | When | Then | Level |
|---|------|-------|------|------|-------|
| 1 | {约束描述} | {前置} | {操作} | {否定断言} | {层级} |

## 5. Degradation Fence（退化围栏）

| # | Known Gap | 底线 | Given | When | Then | Level |
|---|-----------|------|-------|------|------|-------|
| 1 | {缺口} | {底线描述} | {前置} | {操作} | {断言} | {层级} |

## 6. Coverage Matrix（覆盖矩阵）

| 来源 | 测试用例 | 层级 | 状态 |
|------|----------|------|------|
| AC-1 | {test_name} | Unit/Integration/E2E | ✅/⏳ |
| Journey-1 | {test_name} | E2E | ✅/⏳ |
| Constraint-1 | {test_name} | Integration | ✅/⏳ |
| Degradation-1 | {test_name} | Unit | ✅/⏳ |
```

### 守护报告模板（CAP_GUARD_REPORT.md）

```markdown
# 需求守护报告：{一句话标题}

> 执行时间：{YYYY-MM-DD HH:mm}
> 关联规约：[CAP_GUARD.md](CAP_GUARD.md)
> 分支：`{branch}`

## 1. 规约概要

### Capability
{一句话能力宣言}

### 覆盖统计
| 元素 | 规约数 | 测试数 | 通过 | 失败 |
|------|--------|--------|------|------|
| Criteria Matrix | {N} | {N} | {N} | {N} |
| Journey Test | {N} | {N} | {N} | {N} |
| Constraint Guard | {N} | {N} | {N} | {N} |
| Degradation Fence | {N} | {N} | {N} | {N} |

## 2. 测试结果

### 静态检查
- `make typecheck`：{通过/失败}
- `make test`：{通过/失败（N 文件 / M 用例）}

### 单元/集成测试
| 文件 | 用例数 | 通过 | 失败 | 覆盖规约 |
|------|--------|------|------|----------|
| {path} | {n} | {n} | {n} | {AC-1, Constraint-1, ...} |

### E2E 测试
| 文件 | 用例数 | 通过 | 失败 | 覆盖规约 |
|------|--------|------|------|----------|
| {path} | {n} | {n} | {n} | {Journey-1, AC-3, ...} |

## 3. Coverage Matrix（覆盖矩阵）

| 来源 | 测试用例 | 文件 | 层级 | 结果 |
|------|----------|------|------|------|
| AC-1 | {test_name} | {path} | Unit | ✅ |
| Journey-1 | {test_name} | {path} | E2E | ✅ |

## 4. Verdict（裁定）

### 判决
{✅ 守护就绪 / ⚠️ 部分守护 / ❌ 守护不足}

### 证据摘要
- **Criteria Matrix**：{N/M 条覆盖}
- **Journey Test**：{N 个旅程通过}
- **Constraint Guard**：{N/M 条覆盖}
- **Degradation Fence**：{N/M 条覆盖}

### 未覆盖项
{列出规约中存在但未能用测试覆盖的项，说明原因。无则写"无"}

### 新增测试文件
| 文件 | 类型 | 用例数 |
|------|------|--------|
| {path} | Unit/Integration/E2E | {n} |

## 过程备注

{执行过程中捕获的学习信号。无则留空}
```

### 流程

1. 生成守护规约，展示给用户
2. 用 `AskUserQuestion` 确认规约是否准确
3. 确认后编写测试代码
4. 执行测试
5. 生成守护报告
6. 写入 `.worktree/CAP_GUARD.md` 和 `.worktree/CAP_GUARD_REPORT.md`

## 执行规则

1. **三份报告先读完**：不凭空推导规约，必须基于需求报告 + 实现报告 + 验收报告
2. **规约先确认**：编写测试前必须向用户确认守护规约
3. **五元素不可省**：Capability、Criteria Matrix、Journey Test、Constraint Guard、Degradation Fence 每个都要推导，即使某个为空也要显式声明"无"
4. **水平双层必须有**：Criteria Matrix（标准层）和 Journey Test（旅程层）缺一不可
5. **Traceability 贯穿始终**：每个测试用例必须标注对应的规约条目
6. **先手动后自动**：E2E 测试先用 Playwright MCP 手动走通，再写代码
7. **静态检查不跳过**：`make typecheck` + `make test` 必须通过
8. **遵循项目约定**：测试风格与现有测试一致，遵循 CLAUDE.md 约束
9. **覆盖矩阵必须闭合**：规约中的每个条目都要有对应测试或显式声明"不可测/不测"的原因
10. **过程备注**：执行过程中遇到重试、惊讶、绕路、确认、环境等偏差信号时，记录到报告的「过程备注」节。格式：`[重试/惊讶/绕路/确认/环境] 简述`

## 与其他技能的协作

- **完整链条**：`/requirement` → `/implement` → `/accept` → `/cap-guard`
- **需求链路的终点**：守护规约是需求链路的永久化产物——把验收报告的一次性判定固化为可重复执行的自动断言
- **与 test-wt 的区别**：`/test-wt` 是通用测试补全（扫描变更、补全覆盖），`/cap-guard` 是需求驱动的守护测试（从三份报告推导出精确的守护规约）
- **与缺陷守护的关系**：结构同构但推导路径不同——缺陷守护从事故档案推导，需求守护从契约推导
