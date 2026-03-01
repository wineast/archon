---
name: review-defect
description: 缺陷链路评审。当用户说"评审缺陷"、"review-defect"、"审查缺陷链路"、"缺陷能不能合并"等时调用。读取缺陷链路全部报告（DEFECT + FIX + VERIFY + 守护），交叉检验一致性和证据充分性，输出评审意见书（二元合并决策）。
allowed-tools: AskUserQuestion, Read, Grep, Glob, Bash, Write
---

读取缺陷链路全部报告 → 五维度交叉审查 → 生成评审意见书（二元合并决策）。

## 核心理念

Verify 是链路**内部**裁判——参与了过程，有上下文。Review 是链路**外部**审计——只看证据链，零上下文。

```
链路内裁判（verify）              链路外审计（review-defect）
──────────────────               ────────────────────
参与了过程，有确认偏差              只看文件，零偏差
验的是"修得对不对"                 验的是"报告链可不可信"
质证修复报告的声明                  质证整条链路所有报告的一致性
动手验（Playwright + 测试）        读卷宗（交叉检验 + 逻辑推理）
```

Review 不重复 verify 已做的事（不跑 UI、不跑测试）。它检查的是：**verify 做得是否可信，整条证据链是否支撑合并决策。**

### 隐喻

```
缺陷链路：起诉书 → 辩护词 → 审判书 → 评审意见书（上诉审查）
```

审判书是一审判决。评审意见书是上诉法院——不重审事实，审的是**一审程序和推理是否可靠**。

## Phase 0: 读取报告

### 操作

1. **扫描 `.worktree/` 目录**，读取缺陷链路报告：

   | 报告 | 文件名 | 角色 | 必需 |
   |------|--------|------|------|
   | 缺陷报告 | `DEFECT.md` | 起诉书 | ✅ |
   | 修复报告 | `FIX_REPORT.md` | 辩护词 | ✅ |
   | 验证报告 | `VERIFY_REPORT.md` | 审判书 | ✅ |
   | 缺陷守护报告 | `TEST_GUARD_REPORT.md` | 守护测试 | 可选 |

2. 如果三份必需报告中有缺失，提示用户先跑完链路（`/diagnose` → `/fix` → `/verify`）

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

**DEFECT.md** 四要素：
- Delta（偏差：期望行为 vs 实际行为）
- Reproduction Path（复现路径）
- Location（代码定位）
- Impact（影响范围）

**FIX_REPORT.md** 五要素：
- Root Cause（根因）
- Change（变更）
- Rationale（决策依据）
- Blast Radius（影响范围）
- Verification（自测方式）

**VERIFY_REPORT.md** 五要素：
- Reproduction Result（复现验证）
- Cause-Fix Coherence（因果一致性）
- Boundary Validation（边界验证）
- Regression Result（回归验证）
- Verdict（裁定）

缺失核心要素 → 记录：哪份报告缺了什么。

#### 1.3 判定
- **✅ 完整**：所有必要报告存在，核心要素齐全
- **❌ 不完整**：记录具体缺失项

## Phase 2: Cross-Report Consistency（跨报告一致性）

### 目标
检查三份报告之间的链式传递是否断裂——司法三方（起诉、辩护、审判）各自陈述的事实是否吻合。

### 操作

#### 2.1 DEFECT.md → FIX_REPORT.md 追溯

| 检查项 | 方法 |
|--------|------|
| Delta → Root Cause 能解释这个 Delta 吗？ | 逻辑检验：声称的因能导出观察的果吗 |
| Path → Verification 是原路径的镜像吗？ | 步骤比对 |
| Location → Change 修改的是同一区域吗？ | 文件/函数比对 |
| Impact → Blast Radius 覆盖了 Impact 区域吗？ | 范围比对 |

#### 2.2 FIX_REPORT.md → VERIFY_REPORT.md 追溯

| 检查项 | 方法 |
|--------|------|
| Root Cause → Coherence 有质证吗？三项检查都做了吗？ | 结构检查 |
| Change → Coherence 确认改动对症了吗？ | 语义检查 |
| Rationale → Coherence 检验了排除理由吗？ | 语义检查 |
| Verification 路径 → Reproduction 走的是同一条路径吗？ | 步骤比对 |
| Blast Radius 声明的区域 → Regression 有对应验证吗？ | 逐项比对 |

#### 2.3 DEFECT.md → VERIFY_REPORT.md 跨层追溯

| 检查项 | 方法 |
|--------|------|
| 原始 Path → Reproduction 走的是原始 Path 还是修改后的？ | 步骤比对 |
| Delta 的期望行为 → Reproduction 确认恢复到期望了吗？ | 语义检查 |

#### 2.4 重点关注的矛盾类型

- **因果断裂**：Root Cause 声称的原因无法逻辑导出 Delta 描述的现象
- **路径偷换**：Reproduction 走的不是 DEFECT.md 的原始 Path
- **范围缩水**：Blast Radius 声称"不影响 X"，但 DEFECT.md 的 Impact 明确提到 X
- **幽灵修复**：Change 修改的文件/函数与 Location 指出的位置无关
- **边界缺失**：Root Cause 暗示一类问题，但 Boundary 只测了一个变体

#### 2.5 判定
- **✅ 一致**：链式传递无断裂
- **❌ 存在偏差**：记录每处偏差（哪两份报告之间、具体条目）

## Phase 3: Evidence Sufficiency（证据充分性）

### 目标
检查关键声明是否有足够证据支撑。

### 操作

#### 3.1 VERIFY_REPORT.md 证据审查

对每个维度检查：
- **有结论吗**：✅/⚠️/❌ 明确标注了吗？
- **有证据吗**：截图引用存在吗？用 `Glob` 确认 `.worktree/VERIFY_REPORT.assets/` 下文件实际存在
- **证据支撑结论吗**：声称"通过"的项，有对应截图或测试结果吗？

#### 3.2 FIX_REPORT.md 声明抽查

- **Root Cause**：声称的根因是否有代码级证据（指向了具体的代码行/逻辑）？还是纯猜测？
- **Change**：声称修改了哪些文件 → 用 `Grep` 抽查是否确有相关改动
- **Rationale**：排除的替代方案理由是否自洽？

#### 3.3 代码抽查（轻量级）

按 Change 列出的文件，用 `Read` 读 2-3 个关键修改：
- Root Cause 描述的问题代码确实存在/已被修改？
- 修改方式与 Change 描述一致？

#### 3.4 判定
- **✅ 充分**：关键声明都有证据，证据与结论一致
- **❌ 不充分**：记录哪些声明缺乏证据或证据可疑

## Phase 4: Verdict Soundness（裁定合理性）

### 目标
检查 VERIFY_REPORT.md 的 Verdict 是否逻辑上跟得上它自己的证据。

### 操作

#### 4.1 证据-结论一致性

读取四项检查结果和最终 Verdict，检查：

1. **全通过 + 合并** → 合理
2. **Coherence 不一致 + 仍合并** → 危险信号。因果不一致的修复是定时炸弹
3. **Reproduction 通过但 Boundary 失败 + 仍合并** → 只堵了一个洞，旁边还有
4. **Regression 失败 + 仍合并** → 修好了一个弄坏了另一个

#### 4.2 因果一致性特别审查

缺陷链路中 Coherence 是最关键的维度：
- 如果 Verify 声称"一致"，但根据 review 的交叉检验发现因果链有疑点 → 标记
- 典型可疑模式："加了延迟解决了竞态" "加了 try-catch 吞了异常" "加了空值检查但没找到 null 的来源"

#### 4.3 守护报告交叉验证（如有 TEST_GUARD_REPORT.md）

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
.worktree/
├── DEFECT.md                     # 缺陷报告（输入）
├── DEFECT.assets/                # 缺陷截图（输入）
├── FIX_REPORT.md                 # 修复报告（输入）
├── FIX_REPORT.assets/            # 修复截图（输入）
├── VERIFY_REPORT.md              # 验证报告（输入）
├── VERIFY_REPORT.assets/         # 验证截图（输入）
├── TEST_GUARD_REPORT.md          # 守护报告（输入，可选）
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
> 链路类型：缺陷链路
> 审查报告：DEFECT.md, FIX_REPORT.md, VERIFY_REPORT.md{, TEST_GUARD_REPORT.md}
> 分支：`{branch}`

## 0. 审查范围

| 报告 | 角色 | 状态 |
|------|------|------|
| DEFECT.md | 起诉书 | ✅ 已读取 / ❌ 缺失 |
| FIX_REPORT.md | 辩护词 | ✅ 已读取 / ❌ 缺失 |
| VERIFY_REPORT.md | 审判书 | ✅ 已读取 / ❌ 缺失 |
| TEST_GUARD_REPORT.md | 守护测试 | ✅ 已读取 / ⚪ 不存在 |

## 1. Chain Completeness（链路完整性）

### 报告存在性
{必需报告是否齐全}

### 骨架完整性
| 报告 | 缺失要素 |
|------|----------|
| DEFECT.md | {缺失要素，无则写 —} |
| FIX_REPORT.md | {缺失要素，无则写 —} |
| VERIFY_REPORT.md | {缺失要素，无则写 —} |

### 结果
{✅ 完整 / ❌ 不完整}
{一句话说明}

## 2. Cross-Report Consistency（跨报告一致性）

### DEFECT → FIX 追溯

| DEFECT 条目 | 类型 | FIX 对应 | 结果 |
|------------|------|----------|------|
| {Delta 描述} | Delta→Root Cause | {Root Cause 描述} | ✅ 因果通 / ❌ 因果断 |
| {Path 描述} | Path→Verification | {Verification 步骤} | ✅ 镜像 / ❌ 偏移 |
| {Location} | Location→Change | {Change 位置} | ✅ 吻合 / ❌ 偏移 |
| {Impact 范围} | Impact→Blast Radius | {Blast Radius 声明} | ✅ 覆盖 / ❌ 缩水 |

### FIX → VERIFY 追溯

| FIX 声明 | 类型 | VERIFY 对应 | 结果 |
|----------|------|-------------|------|
| {Root Cause} | Root Cause→Coherence | {Coherence 质证} | ✅/❌ |
| {Blast Radius 区域} | Blast Radius→Regression | {Regression 验证} | ✅/❌ |

### DEFECT → VERIFY 跨层追溯

| 检查项 | 结果 |
|--------|------|
| Reproduction 走的是原始 Path？ | ✅/❌ |
| Delta 的期望行为已恢复？ | ✅/❌ |

### 发现的偏差
{逐条列出。无则写"无"}

### 结果
{✅ 一致 / ❌ 存在偏差}
{一句话说明}

## 3. Evidence Sufficiency（证据充分性）

### 验证报告证据审查

| 维度 | 有结论 | 有证据 | 证据支撑结论 |
|------|--------|--------|-------------|
| Reproduction | ✅/❌ | ✅/❌ | ✅/❌ |
| Coherence | ✅/❌ | ✅/❌ | ✅/❌ |
| Boundary | ✅/❌ | ✅/❌ | ✅/❌ |
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
{四项检查结果 → Verdict 的推导是否成立}

### 因果一致性特别审查
{Root Cause → Change 是"治病"还是"止痛"？有无可疑模式？}

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
3. 确认后创建 `.worktree/REVIEWS/` 目录（如不存在）
4. 写入 `.worktree/REVIEWS/REVIEW-{YYYYMMDD-HHmmss}.md`

## 执行规则

1. **纯审计，不动手**：不跑 Playwright，不跑测试，不修改代码。Review 读卷宗，不重审案件
2. **零信任**：每份报告的每个声明都是"待验证假设"
3. **交叉检验优先**：核心价值是三份报告之间的链式追溯——逐条比对
4. **因果链是灵魂**：缺陷链路 review 最关键的检查是 Delta→Root Cause→Change→Reproduction 这条因果链是否无缝
5. **二元决策**：只有"可合并"和"不可合并"，没有"有条件"
6. **代码抽查轻量化**：2-3 次 `Read` 即可，审的是报告质量不是代码质量
7. **具体到条目**：发现问题必须指出"哪份报告的哪个条目与哪份报告的哪个条目矛盾"
8. **止痛嗅探**：特别警惕"加延迟""加 try-catch""加空值检查但不知 null 来源"等止痛式修复

## 与其他技能的协作

- **链路位置**：`/diagnose` → `/fix` → `/verify` → (`/test-guard`) → **`/review-defect`**
- **并发安全**：多个 agent 可同时执行，时间戳文件名避免冲突
- **与 verify 的关系**：verify 动手验，review-defect 读卷宗审。两道门
- **下游**：review 通过后 → `/integrate`（汇总）→ `/release`（发布）
