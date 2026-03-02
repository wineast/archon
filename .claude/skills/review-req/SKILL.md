---
name: review-req
description: 需求链路评审。当用户说"评审需求"、"review-req"、"审查需求链路"、"需求能不能合并"等时调用。读取需求链路全部报告（REQ + IMPL + ACCEPT + 守护），交叉检验一致性和证据充分性，输出评审意见书（二元合并决策）。
allowed-tools: AskUserQuestion, Read, Grep, Glob, Bash, Write
---

读取需求链路全部报告 → 五维度交叉审查 → 生成评审意见书（二元合并决策）。

## 核心理念

Accept 是链路**内部**裁判——参与了过程，有上下文。Review 是链路**外部**审计——只看证据链，零上下文。

```
链路内裁判（accept）              链路外审计（review-req）
──────────────────               ───────────────────
参与了过程，有确认偏差              只看文件，零偏差
验的是"做得对不对"                 验的是"报告链可不可信"
质证实现报告的声明                  质证整条链路所有报告的一致性
动手验（Playwright + 测试）        读卷宗（交叉检验 + 逻辑推理）
```

Review 不重复 accept 已做的事（不跑 UI、不跑测试）。它检查的是：**accept 做得是否可信，整条证据链是否支撑合并决策。**

### 隐喻

```
需求链路：委托书 → 施工报告 → 验收书 → 评审意见书（竣工审计）
```

验收书是甲方验收。评审意见书是独立审计署——不重新验收，审的是**验收程序和推理是否可靠**。

## Phase 0: 读取报告

### 操作

1. **扫描 `.task/` 目录**，读取需求链路报告：

   | 报告 | 文件名 | 角色 | 必需 |
   |------|--------|------|------|
   | 需求报告 | `REQ.md` | 委托书 | ✅ |
   | 实现报告 | `IMPL_REPORT.md` | 施工报告 | ✅ |
   | 验收报告 | `ACCEPT_REPORT.md` | 验收书 | ✅ |
   | 需求守护报告 | `CAP_GUARD_REPORT.md` | 守护测试 | 可选 |

2. 如果三份必需报告中有缺失，提示用户先跑完链路（`/requirement` → `/implement` → `/accept`）

3. **逐份读取**，提取每份报告的核心要素骨架

4. 向用户简要汇报：找到了哪些报告，开始评审

## Phase 1: Chain Completeness（链路完整性）

### 目标
检查链路是否完整——所有必要报告都存在，且每份报告包含其应有的不可约元素。

### 操作

#### 1.1 报告存在性
三份必需报告是否都在？守护报告是否存在？

#### 1.2 骨架完整性

逐份检查核心要素：

**REQ.md** 五要素：
- Who（主体 + 场景）
- Why（动机）
- What（能力声明）
- Acceptance（验收标准清单）
- Constraint（约束）

**IMPL_REPORT.md** 五要素：
- Solution Design（方案设计）
- Design Rationale（设计决策）
- Change Set（变更集）
- Traceability（需求追溯）
- Known Gaps（已知缺口）

**ACCEPT_REPORT.md** 五要素：
- Criteria Verdict（标准裁定）
- Experience Validation（体验验证）
- Gap Assessment（缺口评估）
- Regression Result（回归验证）
- Verdict（裁定）

缺失核心要素 → 记录：哪份报告缺了什么。

#### 1.3 判定
- **✅ 完整**：所有必要报告存在，核心要素齐全
- **❌ 不完整**：记录具体缺失项

## Phase 2: Cross-Report Consistency（跨报告一致性）

### 目标
检查三份报告之间的链式传递是否断裂——前一份报告声明的内容，后一份报告是否正确引用和回应。

### 操作

#### 2.1 REQ.md → IMPL_REPORT.md 追溯

| 检查项 | 方法 |
|--------|------|
| 每条 What → Traceability 有对应行？ | 逐条比对 |
| 每条 Acceptance → Traceability 有验证方式？ | 逐条比对 |
| 每条 Constraint → Traceability 有合规说明？ | 逐条比对 |
| Who 的场景 → Solution Design 的用户流程覆盖？ | 语义检查 |
| Why → Design Rationale 有锚定？ | 语义检查 |

#### 2.2 IMPL_REPORT.md → ACCEPT_REPORT.md 追溯

| 检查项 | 方法 |
|--------|------|
| Traceability 的每条 What → Criteria Verdict 有对应验证？ | 逐条比对 |
| REQ.md 的 Acceptance 数量 = Criteria Verdict 数量？ | 计数 |
| 每个 Known Gap → Gap Assessment 有对应评估？ | 逐条比对 |
| Change Set 涉及的模块 → Regression 有对应检查？ | 语义检查 |
| REQ.md 的 Constraint → Regression 的 Constraint 合规逐项确认？ | 逐条比对 |

#### 2.3 重点关注的矛盾类型

- **数量不匹配**：REQ.md 有 5 条 Acceptance，Criteria Verdict 只验了 4 条
- **内容偷换**：Traceability 声称覆盖了某条 What，但实际实现描述对不上
- **结论遗漏**：某项 ⚠️ 部分通过，但 Verdict 未提及
- **幽灵引用**：报告引用了前置报告中不存在的条目

#### 2.4 判定
- **✅ 一致**：链式传递无断裂
- **❌ 存在偏差**：记录每处偏差（哪两份报告之间、具体条目）

## Phase 3: Evidence Sufficiency（证据充分性）

### 目标
检查关键声明是否有足够证据支撑。

### 操作

#### 3.1 ACCEPT_REPORT.md 证据审查

对每个维度检查：
- **有结论吗**：✅/⚠️/❌ 明确标注了吗？
- **有证据吗**：截图引用存在吗？用 `Glob` 确认 `.task/ACCEPT_REPORT.assets/` 下文件实际存在
- **证据支撑结论吗**：声称"通过"的项，有对应截图或测试结果吗？

#### 3.2 IMPL_REPORT.md 声明抽查

- **Traceability**：声称修改了哪些文件 → 用 `Grep` 抽查 2-3 个文件是否确有相关改动
- **Known Gaps**：声称的范围是否合理？有没有遗漏明显相关的模块？
- **Design Rationale**：决策理由是否自洽（纯逻辑检验）

#### 3.3 代码抽查（轻量级）

按 Change Set 列出的文件，用 `Read` 读 2-3 个关键文件：
- 确认报告描述与实际代码一致
- 如发现明显出入，记录为证据缺陷

#### 3.4 判定
- **✅ 充分**：关键声明都有证据，证据与结论一致
- **❌ 不充分**：记录哪些声明缺乏证据或证据可疑

## Phase 4: Verdict Soundness（裁定合理性）

### 目标
检查 ACCEPT_REPORT.md 的 Verdict 是否逻辑上跟得上它自己的证据。

### 操作

#### 4.1 证据-结论一致性

读取五项检查结果和最终 Verdict，检查：

1. **全通过 + 合并** → 合理
2. **某项未通过 + 仍合并** → 有解释吗？解释成立吗？
3. **全通过 + 有条件合并** → 条件从哪来？合理吗？
4. **驳回但理由模糊** → 需具体指出阻塞项

#### 4.2 遗漏风险

- Gap Assessment 中有 🚫 阻塞项，但 Verdict 没有体现？
- Regression 发现问题但 Verdict 忽略？
- "有条件合并"的条件是否明确、可追踪？

#### 4.3 守护报告交叉验证（如有 CAP_GUARD_REPORT.md）

- 守护测试通过了吗？
- 如果失败，Verdict 是否考虑了这个信号？

#### 4.4 判定
- **✅ 合理**：Verdict 从证据自然推出
- **❌ 存疑**：Verdict 与证据之间有逻辑跳跃

## Phase 5: 生成评审意见书

### 五个维度

```
                评审意见书
                    │
         ┌──────────┼──────────┐
         │          │          │
    Completeness Consistency Evidence
    (链路完整吗)  (报告矛盾吗) (证据够吗)
         │          │          │
         └──────────┼──────────┘
                    │
          ┌─────────┴─────────┐
          │                   │
      Soundness           Decision
      (裁定合理吗)         (合不合并)
```

### 核心原则：二元决策

Decision 必须是二元的——**可合并**或**不可合并**。没有"有条件可合并"。

理由：review 是最终闸门。有条件 = 条件没满足 = 不可合并。条件满足后再跑一次 review。

### 资源管理

```
.task/
├── REQ.md                        # 需求报告（输入）
├── IMPL_REPORT.md                # 实现报告（输入）
├── IMPL_REPORT.assets/           # 实现截图（输入）
├── ACCEPT_REPORT.md              # 验收报告（输入）
├── ACCEPT_REPORT.assets/         # 验收截图（输入）
├── CAP_GUARD_REPORT.md           # 守护报告（输入，可选）
├── REVIEWS/                      # 评审意见书目录（输出）
│   ├── REVIEW-20260301-143052.md
│   ├── REVIEW-20260301-160821.md
│   └── ...
```

文件名格式：`REVIEW-{YYYYMMDD-HHmmss}.md`，按时间戳命名，支持多 agent 并发。

### 报告模板

```markdown
# 评审意见书：{一句话总结}

> 评审时间：{YYYY-MM-DD HH:mm}
> 链路类型：需求链路
> 审查报告：REQ.md, IMPL_REPORT.md, ACCEPT_REPORT.md{, CAP_GUARD_REPORT.md}
> 分支：`{branch}`

## 0. 审查范围

| 报告 | 角色 | 状态 |
|------|------|------|
| REQ.md | 委托书 | ✅ 已读取 / ❌ 缺失 |
| IMPL_REPORT.md | 施工报告 | ✅ 已读取 / ❌ 缺失 |
| ACCEPT_REPORT.md | 验收书 | ✅ 已读取 / ❌ 缺失 |
| CAP_GUARD_REPORT.md | 守护测试 | ✅ 已读取 / ⚪ 不存在 |

## 1. Chain Completeness（链路完整性）

### 报告存在性
{必需报告是否齐全}

### 骨架完整性
| 报告 | 缺失要素 |
|------|----------|
| REQ.md | {缺失要素，无则写 —} |
| IMPL_REPORT.md | {缺失要素，无则写 —} |
| ACCEPT_REPORT.md | {缺失要素，无则写 —} |

### 结果
{✅ 完整 / ❌ 不完整}
{一句话说明}

## 2. Cross-Report Consistency（跨报告一致性）

### REQ → IMPL 追溯

| REQ 条目 | 类型 | IMPL Traceability 覆盖 | 结果 |
|----------|------|------------------------|------|
| {条目} | What/Acceptance/Constraint | {对应行} | ✅/❌ |

### IMPL → ACCEPT 追溯

| IMPL 声明 | 类型 | ACCEPT 对应 | 结果 |
|-----------|------|-------------|------|
| {条目} | Traceability/Known Gap | {Criteria/Gap Assessment 对应行} | ✅/❌ |

### 发现的偏差
{逐条列出。无则写"无"}

### 结果
{✅ 一致 / ❌ 存在偏差}
{一句话说明}

## 3. Evidence Sufficiency（证据充分性）

### 验收报告证据审查

| 维度 | 有结论 | 有证据 | 证据支撑结论 |
|------|--------|--------|-------------|
| Criteria Verdict | ✅/❌ | ✅/❌ | ✅/❌ |
| Experience Validation | ✅/❌ | ✅/❌ | ✅/❌ |
| Gap Assessment | ✅/❌ | ✅/❌ | ✅/❌ |
| Regression | ✅/❌ | ✅/❌ | ✅/❌ |

### 代码抽查
| 文件 | 报告声称 | 实际代码 | 一致 |
|------|----------|----------|------|
| {路径} | {描述} | {实际} | ✅/❌ |

### 结果
{✅ 充分 / ❌ 不充分}
{一句话说明}

## 4. Verdict Soundness（裁定合理性）

### 证据-结论一致性
{五项检查结果 → Verdict 的推导是否成立}

### 遗漏风险
{应提到但未提到的。无则写"无"}

### 守护报告信号
{守护测试结果与 Verdict 是否一致。无守护报告则写"未执行守护测试"}

### 结果
{✅ 合理 / ❌ 存疑}
{一句话说明}

## 5. Decision（合并决策）

### 判决
{✅ 可合并 / ❌ 不可合并}

### 四维度摘要
- **Completeness**：{一句话}
- **Consistency**：{一句话}
- **Evidence**：{一句话}
- **Soundness**：{一句话}

### 理由
{为什么可以/不可以合并——具体到维度和条目}

### 阻塞项
{不可合并时列出必须解决的问题。可合并时写"无"}

### 建议
{可合并时的非阻塞性改进建议。不可合并时写"无——请先解决阻塞项"}
```

### 流程

1. 生成评审意见书内容，展示给用户
2. 用 `AskUserQuestion` 确认内容是否准确
3. 确认后创建 `.task/REVIEWS/` 目录（如不存在）
4. 写入 `.task/REVIEWS/REVIEW-{YYYYMMDD-HHmmss}.md`

## 执行规则

1. **纯审计，不动手**：不跑 Playwright，不跑测试，不修改代码。Review 读卷宗，不重审案件
2. **零信任**：每份报告的每个声明都是"待验证假设"
3. **交叉检验优先**：核心价值是报告之间的链式追溯——逐条比对，不放过数量不匹配
4. **二元决策**：只有"可合并"和"不可合并"，没有"有条件"
5. **代码抽查轻量化**：2-3 次 `Read` 即可，审的是报告质量不是代码质量
6. **具体到条目**：发现问题必须指出"哪份报告的哪个条目与哪份报告的哪个条目矛盾"
7. **尊重前审**：如果 accept 的 Verdict 有充分证据支撑且逻辑自洽，不因"风格不同"而驳回

## 与其他技能的协作

- **链路位置**：`/requirement` → `/implement` → `/accept` → (`/cap-guard`) → **`/review-req`**
- **并发安全**：多个 agent 可同时执行，时间戳文件名避免冲突
- **与 accept 的关系**：accept 动手验，review-req 读卷宗审。两道门
- **下游**：review 通过后 → `/integrate`（汇总）→ `/release`（发布）
