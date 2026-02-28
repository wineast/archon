---
name: verify
description: 验证修复。当用户说"验证"、"verify"、"检验修复"、"能不能合并"、"验收"等时调用。读取缺陷报告和修复报告，执行五维度验证，生成验证报告。
allowed-tools: AskUserQuestion, Read, Grep, Glob, Task, Bash, Write, Edit, mcp__playwright__*
---

读取缺陷报告 + 修复报告 → 五维度验证 → 生成验证报告。

## 核心理念

缺陷报告传递**事实**（什么坏了），修复报告传递**决策**（怎么修的），验证报告传递**判决**（能不能合并）。

验证报告不是测试报告。"测试通过"只是证据的一种。合并决策需要综合判断——测试可能没覆盖关键路径，Root Cause 可能被误诊，修复可能只是压制了症状。验证报告是**审判书**。

### 三份文档的司法隐喻

```
缺陷报告 → 起诉书（陈述事实）
修复报告 → 辩护词（解释行为）
验证报告 → 审判书（质证双方 + 裁定）
```

验证者不是修复者的助手，是独立的第三方裁判。

### 与修复报告的镜像关系

```
修复报告                        验证报告
────────                        ────────
Root Cause (根因)    ──质证──→   Coherence (因果一致性)
  "因为 X 所以坏了"               "X 真的能导致这个现象吗？"

Change (变更)        ──质证──→   Coherence (因果一致性)
  "改了 Y"                       "Y 真的能消除 X 吗？"

Rationale (决策)     ──质证──→   Coherence (因果一致性)
  "选 A 不选 B 因为..."          "这个理由成立吗？"

Verification (验证)  ──执行──→   Reproduction (复现验证)
  "按这个步骤确认"               "执行了，结果是..."

Blast Radius (波及)  ──执行──→   Regression (回归验证)
  "可能影响 Z 区域"              "Z 区域验过了，结果是..."

     ∅               ──新增──→   Boundary (边界验证)
                                  "还有这些变体也要验"

     ∅               ──新增──→   Verdict (裁定)
                                  "综上，合并/驳回"
```

新增两个元素：**Boundary**（修复者不会主动挑战自己的修复）和 **Verdict**（修复者不做合并决策）。

## Phase 0: 读取输入报告

### 操作

1. 读取 `.worktree/DEFECT.md`，提取：
   - **Delta**：期望行为、实际行为
   - **Path**：复现步骤
   - **Location**：代码定位、根因分析
   - **Impact**：影响范围

2. 读取 `.worktree/FIX_REPORT.md`，提取：
   - **Root Cause**：声称的根因
   - **Change**：修改了什么
   - **Rationale**：为什么这样改
   - **Blast Radius**：声称的影响范围
   - **Verification**：修复者自测的方式

3. 如果任一文件不存在，提示用户先运行 `/diagnose` + `/fix`

4. 向用户简要复述两份报告要点，进入验证

## Phase 1: Reproduction Result（复现验证）

### 目标
用缺陷报告的原始 Path 端到端走一遍，确认 Delta 不再出现。

### 操作

#### 1.1 检查环境
检查 dev 服务器是否在运行：
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:{端口号} 2>/dev/null
```
如果存在 `.worktree/meta.json`，从中读取端口号；否则使用默认 3000。

如果未运行：`make up`（`run_in_background=true`），轮询等待就绪，**最多 15s**。超时则 `make down` + `make up` 重启，仍失败则报错给用户。

#### 1.2 按缺陷报告的复现路径逐步操作
1. 用 Playwright 导航到起始页面
2. 按 DEFECT.md 的操作步骤逐步执行
3. 在原来出现缺陷的步骤截图
4. 确认期望行为已恢复

#### 1.3 判定
- **通过**：修复至少在已知路径上消除了症状
- **未通过**：修复无效，直接驳回，后续步骤无需继续

### 截图命名
- `.worktree/VERIFY_REPORT.assets/verify-{简述}-repro.png`

## Phase 2: Cause-Fix Coherence（因果一致性）

### 目标
质证修复报告中声称的 Root Cause 和 Rationale 是否经得起推敲。

### 操作

#### 2.1 三项检查

1. **Root Cause 可解释 Delta**
   - 读取修复报告的 Root Cause 和缺陷报告的 Delta
   - 判断：声称的原因能否逻辑上导出观察到的现象？
   - 反例检验：有没有其他更合理的原因能解释同样的现象？

2. **Change 可消除 Root Cause**
   - 读取修改的代码（按 FIX_REPORT.md 的 Change 明细）
   - 判断：改动是否从机理上切断了因果链，而非绕过它？
   - 反例检验：改动是"治病"还是"止痛"？

3. **Rationale 无漏洞**
   - 读取被排除的替代方案和排除理由
   - 判断：排除理由是否成立？选择的方案有无逻辑盲区？

#### 2.2 判定
- **一致**：Root Cause→Delta 逻辑通，Change→消除 Root Cause 逻辑通，Rationale 无漏洞
- **不一致**：发现逻辑断裂或漏洞。记录具体问题

## Phase 3: Boundary Validation（边界验证）

### 目标
在原始复现路径的变体下验证修复是否依然有效。

### 操作

#### 3.1 确定边界变体来源

三个来源：
- **Root Cause 推导**：根因涉及什么类型的问题？同类输入还有哪些？
- **Change 波及推导**：改了这个函数/模块，其他调用路径有没有同类问题？
- **领域知识**：这类缺陷的常见变体（如不同数据量、不同视口尺寸、空数据、极端值等）

#### 3.2 执行边界测试
- 用 Playwright 测试至少 2-3 个边界变体
- 每个变体记录：输入条件、操作步骤、预期结果、实际结果

#### 3.3 判定
- **通过**：所有变体都表现正常
- **部分通过**：大部分通过但有边缘情况不理想（记录具体情况）
- **未通过**：发现修复未覆盖的同类漏洞

### 截图命名
- `.worktree/VERIFY_REPORT.assets/verify-{简述}-boundary-{N}.png`

## Phase 4: Regression Result（回归验证）

### 目标
确认修复没有弄坏其他东西。

### 操作

#### 4.1 静态检查
```bash
make typecheck
make test
```

#### 4.2 Blast Radius 定向验证
- 按修复报告的 Blast Radius 声明，逐项检查
- 直接影响区域：用 Playwright 走一遍，确认行为正常
- 间接影响区域：抽检
- "不影响"声明：抽检验证声明是否属实

#### 4.3 判定
- **通过**：静态检查通过 + Blast Radius 区域无回归
- **未通过**：发现回归问题

### 截图命名
- `.worktree/VERIFY_REPORT.assets/verify-{简述}-regression-{N}.png`

## Phase 5: 生成验证报告 + 合并脚本 + 启动预览

### 五个不可约元素

```
             验证报告
                │
     ┌──────────┼──────────┐
     │          │          │
Reproduction  Coherence  Boundary
(缺陷消了吗)  (因果对吗) (边界扛吗)
     │          │          │
     └──────────┼──────────┘
                │
      ┌─────────┴─────────┐
      │                   │
  Regression           Verdict
  (别处坏了吗)          (合不合并)
```

### 资源管理

所有验证产物统一放在 `.worktree/` 下：
```
.worktree/
├── DEFECT.md                           # 缺陷报告（输入）
├── DEFECT.assets/                      # 缺陷截图
├── FIX_REPORT.md                       # 修复报告（输入）
├── FIX_REPORT.assets/                  # 修复截图
├── VERIFY_REPORT.md                    # 验证报告（输出）
├── VERIFY_REPORT.assets/               # 验证截图
│   ├── verify-{简述}-repro.png
│   ├── verify-{简述}-boundary-{N}.png
│   └── verify-{简述}-regression-{N}.png
└── merge.sh                            # 合并脚本（输出）
```

### 报告模板

```markdown
# 验证报告：{一句话标题}

> 验证时间：{YYYY-MM-DD HH:mm}
> 关联修复：[FIX_REPORT.md](FIX_REPORT.md)
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 分支：`{branch}`

## 1. Reproduction Result（复现验证）

### 验证方式
{端到端按缺陷报告原始路径操作，具体步骤}

### 结果
{✅ 通过 / ❌ 未通过}
{一句话说明}

### 证据
| 验证项 | 截图 |
|--------|------|
| {步骤描述} | ![repro](VERIFY_REPORT.assets/verify-{简述}-repro.png) |

## 2. Cause-Fix Coherence（因果一致性）

### Root Cause 可解释 Delta？
{分析：声称的根因能否逻辑上导出观察到的现象}

### Change 可消除 Root Cause？
{分析：改动是否从机理上切断因果链}

### Rationale 无漏洞？
{分析：替代方案排除理由是否成立}

### 结果
{✅ 一致 / ❌ 不一致}
{一句话说明}

## 3. Boundary Validation（边界验证）

### 测试的边界变体
| 变体 | 条件 | 结果 |
|------|------|------|
| {变体 1} | {输入条件} | {✅/❌ + 说明} |
| {变体 2} | {输入条件} | {✅/❌ + 说明} |

### 证据
| 验证项 | 截图 |
|--------|------|
| {变体描述} | ![boundary](VERIFY_REPORT.assets/verify-{简述}-boundary-{N}.png) |

### 结果
{✅ 通过 / ⚠️ 部分通过 / ❌ 未通过}
{一句话说明}

## 4. Regression Result（回归验证）

### 静态检查
- `make typecheck`：{通过/失败}
- `make test`：{通过/失败（N 文件 / M 用例）}

### Blast Radius 区域验证
| 区域 | 修复报告声明 | 实际验证结果 |
|------|-------------|-------------|
| {区域 1} | {直接/间接/不影响} | {✅ 正常 / ❌ 发现回归} |

### 结果
{✅ 通过 / ❌ 未通过}
{一句话说明}

## 5. Verdict（裁定）

### 判决
{✅ 合并 / ⚠️ 有条件合并 / ❌ 驳回}

### 证据摘要
- **Reproduction**：{一句话}
- **Coherence**：{一句话}
- **Boundary**：{一句话}
- **Regression**：{一句话}

### 残留风险
{如有，列出需后续跟进的事项；否则"无"}
```

### 报告自检清单

- [ ] **Reproduction**：按原路径走了吗？截图附了吗？
- [ ] **Coherence**：三项检查都做了吗？逻辑链完整吗？
- [ ] **Boundary**：测了 2-3 个变体吗？来源有据吗？
- [ ] **Regression**：静态检查跑了吗？Blast Radius 区域验了吗？
- [ ] **Verdict**：证据摘要覆盖四项吗？残留风险标了吗？

### 生成合并脚本

如果 `.worktree/meta.json` 存在（工作区模式），生成 `.worktree/merge.sh`：

```bash
#!/bin/bash
# 验证通过的合并脚本 — <工作区名称> → <baseBranch>
# 验证报告: VERIFY_REPORT.md
# 生成时间: <时间>
set -e

MAIN_REPO="<主仓库绝对路径>"
WT_NAME="<工作区名称>"

echo "🔀 合并 $WT_NAME → <baseBranch>"
make -C "$MAIN_REPO" wt-merge NAME="$WT_NAME"

# 合并后检测 schema 变更
if git -C "$MAIN_REPO" diff HEAD~1 --name-only | grep -qE "(drizzle/|db/schema\.ts)"; then
    echo ""
    echo "⚠️  检测到 schema 变更，请执行: make db-generate"
fi

echo ""
echo "✅ 合并完成"
echo "下一步（可选）："
echo "  make wt-delete NAME=$WT_NAME    # 删除工作区"
```

如果不在工作区（无 meta.json），生成分支合并脚本：

```bash
#!/bin/bash
# 验证通过的合并脚本 — <当前分支> → main
# 验证报告: VERIFY_REPORT.md
set -e

CURRENT_BRANCH="<当前分支>"
TARGET_BRANCH="main"

echo "🔀 合并 $CURRENT_BRANCH → $TARGET_BRANCH"
git checkout "$TARGET_BRANCH"
git merge --squash "$CURRENT_BRANCH"
git commit -m "feat: <修复摘要>"

echo ""
echo "✅ 合并完成"
```

生成后设为可执行：`chmod +x .worktree/merge.sh`

### 流程

1. 生成报告内容，展示给用户
2. 用 `AskUserQuestion` 确认报告是否准确
3. 确认后写入 `.worktree/VERIFY_REPORT.md`
4. 生成 `merge.sh`

## 执行规则

1. **独立判断**：验证者是第三方裁判，不是修复者的助手。修复者的声明都是"待质证假设"
2. **必须复现**：用 Playwright 端到端走完原路径，不能只看修复者的截图
3. **因果必须质证**：复现通过不够，还要确认 Root Cause 分析正确、Change 对症
4. **边界必须探测**：修复者只堵了已知的洞，验证者要检查旁边有没有同类洞
5. **回归必须验证**：不信"不影响"声明，抽检验证
6. **静态检查不跳过**：`make typecheck` + `make test` 必须通过
7. **截图取证**：每个维度的验证都要截图
8. **Verdict 有理有据**：判决必须基于四项验证证据，不可跳过

## 与其他技能的协作

- **完整链条**：`/diagnose` → 缺陷报告 → `/fix` → 修复报告 → `/verify` → 验证报告 → 合并
- **在工作区中**：`/create-wt` → `/diagnose` → `/fix` → `/verify`（验证报告中可直接合并）
- **质量闸门**：验证报告是合并前的最后一道门，Verdict 决定是否放行
