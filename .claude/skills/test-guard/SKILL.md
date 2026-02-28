---
name: test-guard
description: 缺陷守护。当用户说"守护"、"guard"、"写守护测试"、"防回归"、"test guard"、"补测试"、"写测试"等时调用。读取缺陷链路三份报告，推导守护规约，编写测试代码，生成测试报告，启动 HTML 预览服务。
allowed-tools: AskUserQuestion, Read, Grep, Glob, Task, Bash, Write, Edit, mcp__playwright__*
---

读取三份报告 → 推导守护规约 → 编写测试代码 → 运行验证 → 生成报告 → 启动 HTML 预览。

## 核心理念

验证/验收证明"现在好了"，测试保证"以后也好"。

验证报告是一次性人工判定——此刻缺陷消了、因果对了、边界扛了、回归没了。但明天有人改了相关代码呢？测试守护把一次性的人工判定**固化为可重复执行的自动断言**，使得"此刻证明过的事实"在未来的每次构建中被持续验证。

### 四份文档的司法隐喻

```
缺陷报告 → 起诉书（陈述事实）
修复报告 → 辩护词（解释行为）
验证报告 → 审判书（质证双方 + 裁定）
守护规约 → 守卫部署令（永久驻防）
```

验证者是法官，宣判后离场。守护者是宪兵，部署后永远驻守。

### 关键洞察：双层防护

缺陷守护必须同时防护两个层面：

| 层级 | 测什么 | 为什么 |
|------|--------|--------|
| 症状层 | 用户可见的行为不再出错 | 防止同样的症状以任何方式复现 |
| 根因层 | 底层故障机制不再被触发 | 防止同一故障机制从其他路径爆出 |

只测症状：根因从别的路径爆出时，症状测试没覆盖那条路径，漏网。
只测根因：另一个不同的机制也能导致同样的症状，根因测试看不到。

**双层防护 = E2E 守症状 + Unit/Integration 守根因。**

### 与验证报告的镜像关系

```
验证报告                        守护规约
────────                        ────────
Reproduction ──固化──→ Invariant + Trigger Scenario
  "此刻缺陷消了"                 "永远不能再出现"

Coherence    ──锚定──→ Cause Anchor
  "因果链成立"                   "在故障机制层钉钉子"

Boundary     ──纳入──→ Boundary Set
  "变体也扛住了"                 "变体永远扛住"

Regression   ──永久化──→ Blast Shield
  "修复没弄坏别的"               "永远不弄坏别的"

Verdict      ──归档──→ Traceability
  "判决：合并"                   "追溯：因何而生"
```

新增 **Cause Anchor**（验证报告不写代码，守护规约要在根因层面钉钉子）和 **Traceability**（验证报告不需要追溯自身，守护规约要链接回源头）。

## Phase 0: 读取三份报告

### 操作

1. 读取 `.worktree/DEFECT.md`，提取：
   - **Delta**：期望行为、实际行为（→ Invariant）
   - **Path**：复现步骤（→ Trigger Scenario）

2. 读取 `.worktree/FIX_REPORT.md`，提取：
   - **Root Cause**：故障机制（→ Cause Anchor, Boundary Set）
   - **Change**：修改了什么（→ Cause Anchor）
   - **Blast Radius**：影响范围（→ Blast Shield）

3. 读取 `.worktree/VERIFY_REPORT.md`，提取：
   - **Reproduction**：复现验证结果
   - **Boundary Validation**：已验证的边界变体（→ Boundary Set）
   - **Regression Result**：回归验证结果（→ Blast Shield）
   - **Verdict**：合并裁定

4. 如果任一文件不存在，提示用户先运行完整链路 `/diagnose` → `/fix` → `/verify`

5. 如果 Verdict 为"驳回"，提示用户：验证未通过，应先修复问题再写守护测试

6. 向用户简要复述三份报告要点，进入推导

## Phase 1: 推导守护规约

### 目标
从三份报告推导出五个不可约元素，形成完整的测试蓝图。

### 五个不可约元素

```
             缺陷守护规约
                  │
          ┌───────┼───────┐
          │       │       │
     Invariant  Trigger  Cause
      (守什么)  (怎么触发) Anchor
                          (根因钉)
          │       │       │
          └───────┼───────┘
                  │
          ┌───────┴───────┐
          │               │
     Boundary Set    Blast Shield
      (变体集)        (防爆盾)
```

### 1.1 推导 Invariant（不变量）

**来源**：DEFECT.md 的 Delta 取反

Delta 说"什么坏了"，Invariant 说"什么不能再坏"。

推导步骤：
1. 读取 Delta 的"期望行为"和"实际行为"
2. 将"期望行为"断言化：用一句话描述必须永远为真的事实
3. 精确度检查：读完能直接写 `expect()` 断言吗？
   - 太模糊："保存功能正常" ← 无法转为断言
   - 恰好："编辑 name 为 'X' → 切 tab → 切回 → 保存 → 刷新，name 应等于 'X'" ← 可直接 `expect(name).toBe('X')`
   - 过度："formState.dirtyFields 应包含 name 键..." ← 这是实现细节，属于 Cause Anchor

### 1.2 推导 Trigger Scenario（触发场景）

**来源**：DEFECT.md 的 Path + FIX_REPORT.md 的 Root Cause

将复现路径转化为 Given/When/Then，同时用 Root Cause 剔除冗余步骤。

推导步骤：
1. 读取 Path 的全部复现步骤
2. 参考 Root Cause 判断每一步是否因果相关
3. 保留因果相关步骤，剔除冗余（如"等待 N 秒"若与 bug 无关则删）
4. 转化为 Given（前置状态）/ When（操作）/ Then（断言）
5. 确定 Level：涉及用户可见行为 → E2E

**为什么要精简**：冗余步骤引入虚假依赖。如果"等待 3 秒"与 bug 无关但保留在测试里，未来有人优化了加载速度，测试就会 fail for wrong reason。

### 1.3 推导 Cause Anchor（根因锚点）

**来源**：FIX_REPORT.md 的 Root Cause + Change

在故障机制层面钉一颗钉子。这是缺陷守护独有的元素——需求测试没有这个概念。

推导步骤：
1. 读取 Root Cause 的故障机制描述
2. 读取 Change 的修改明细，找到被修复的代码位置
3. 设计一个直接测试故障机制的断言（代码视角，不是用户视角）
4. 确定 Level：通常是 Unit 或 Integration

Invariant 和 Cause Anchor 的区别——不同抽象层级的断言：
- Invariant（症状层）："保存后 name 不丢失"——用户视角
- Cause Anchor（机制层）："tab 切换时 formState 不被 reset"——代码视角

同一个 bug 的两道防线，一道在外（用户看到的），一道在内（代码里的）。

```
       E2E层    ─── Invariant + Trigger Scenario
                     "用户视角：保存后 name 在"

  Integration  ─── Cause Anchor（可能在此层）

      Unit层   ─── Cause Anchor
                     "代码视角：tab 切换不 reset form"
```

### 1.4 推导 Boundary Set（边界集）

**来源**：VERIFY_REPORT.md 的 Boundary Validation + FIX_REPORT.md 的 Root Cause 推导

两类变体，逻辑不同：

- **经验变体**（来源 1）：验证报告中已手动验证过的边界 case → 直接转为测试用例
- **推理变体**（来源 2）：从 Root Cause 推导出的同类触发条件（验证者可能没想到的）

推理变体是缺陷守护比手动验证更强的地方——它可以覆盖验证者没想到但逻辑上应该测的 case。

推导步骤：
1. 逐条读取 Boundary Validation 中的变体 → 经验变体
2. 从 Root Cause 画圆，半径一步推导：
   - 同一机制的不同触发路径
   - 同一函数的不同输入值
3. 合并去重

**收敛原则**：围绕 Root Cause 画圆，半径不超过一步推导。
- 同一机制的不同触发路径 ← 要测
- 同一函数的不同输入值 ← 要测
- 不同机制但类似症状 ← 太远，不属于此 bug 的守护范围

### 1.5 推导 Blast Shield（防爆盾）

**来源**：FIX_REPORT.md 的 Blast Radius + VERIFY_REPORT.md 的 Regression Result

把验证报告的一次性回归检查永久化。

Blast Shield 和 Boundary Set 的区别——方向不同：
- Boundary Set 是内向的——同一个 bug 的不同触发变体（围绕缺陷本身）
- Blast Shield 是外向的——修复可能影响的其他功能（围绕修复的影响面）

Boundary Set 问"bug 有没有兄弟"。Blast Shield 问"药有没有副作用"。

推导步骤：
1. 读取 Blast Radius 中标记为"直接影响"的区域
2. 读取 Regression Result 中的验证结论
3. 为每个直接影响区域设计一个回归断言
4. 不做全量回归——那是 CI 的事，Blast Shield 只守修复波及的区域

### 1.6 汇总规约

将五个元素组织为结构化规约，展示给用户确认后进入编码。

## Phase 2: 编写测试代码

### 目标
将守护规约翻译为可执行的测试代码。

### 操作

#### 2.1 确定测试文件分布

```
Invariant + Trigger Scenario  → E2E 测试文件（症状层防线）
Cause Anchor                  → Unit/Integration 测试文件（根因层防线）
Boundary Set                  → 追加到对应层级的测试文件
Blast Shield                  → 追加到对应层级的测试文件
```

#### 2.2 扫描现有测试

- 扫描 `web/src/**/__tests__/` 了解单元测试模式
- 扫描 `web/e2e/` 了解 E2E 测试模式
- 找到与修复代码相关的现有测试文件

#### 2.3 编写 Unit/Integration 测试

针对 Cause Anchor + 相关 Boundary Set 变体 + Blast Shield：

1. 在修复代码对应的 `__tests__/` 目录下创建或追加测试
2. 文件命名：`{模块名}.guard.test.ts`（`.guard.` 标识为守护测试）
3. 测试结构：
   ```typescript
   /**
    * 缺陷守护：{Invariant 一句话}
    * @see .worktree/DEFECT.md
    * @see .worktree/FIX_REPORT.md
    * @see .worktree/VERIFY_REPORT.md
    */
   describe("Guard: {Invariant}", () => {
     describe("Cause Anchor: {根因描述}", () => {
       test("{具体断言}", () => { ... });
     });

     describe("Boundary", () => {
       test("{变体 1}", () => { ... });
       test("{变体 2}", () => { ... });
     });

     describe("Blast Shield: {区域}", () => {
       test("{回归断言}", () => { ... });
     });
   });
   ```

#### 2.4 编写 E2E 测试

针对 Trigger Scenario + 相关 Boundary Set 变体：

1. 在 `web/e2e/` 下创建测试文件
2. 文件命名：`guard-{简述}.spec.ts`
3. 遵循 CLAUDE.md E2E 约定（`data-testid`、`test.step` 中文命名、日志约定等）
4. 测试结构：
   ```typescript
   /**
    * 缺陷守护 E2E：{Invariant}
    *
    * 守护目标：{一句话}
    * 触发路径：{Given → When → Then 概述}
    *
    * @see .worktree/DEFECT.md
    * @see .worktree/FIX_REPORT.md
    * @see .worktree/VERIFY_REPORT.md
    */
   const TAG = "[guard-{简述}]";
   const log = (...args: unknown[]) => console.log(TAG, ...args);

   test.describe("缺陷守护：{Invariant}", () => {
     test("触发场景：{Trigger 概述}", async ({ page }) => {
       await test.step("前置：{Given}", async () => { ... });
       await test.step("操作：{When}", async () => { ... });
       await test.step("断言：{Then}", async () => { ... });
     });

     test("边界变体：{变体描述}", async ({ page }) => { ... });
   });
   ```

#### 2.5 代码质量

- 遵循 CLAUDE.md 所有约定（E2E、Testing 相关）
- 每个测试文件头部 JSDoc 包含 Traceability 指回三份报告
- Guard 测试文件用 `.guard.` 后缀（Unit）或 `guard-` 前缀（E2E），与普通测试区分

## Phase 3: 运行测试 + 生成报告 + 启动预览

### 3.1 运行测试

```bash
make typecheck
make test
```

如果有 E2E 测试，用 `AskUserQuestion` 询问用户是否运行（耗时较长）。

如果测试失败：
- 分析失败原因
- 修复测试代码（不修改业务代码——如果业务代码有问题，应回到 `/fix`）
- 重新运行直到通过

### 3.2 生成守护报告

### 报告模板

```markdown
# 测试守护报告：{一句话标题}

> 生成时间：{YYYY-MM-DD HH:mm}
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 关联修复：[FIX_REPORT.md](FIX_REPORT.md)
> 关联验证：[VERIFY_REPORT.md](VERIFY_REPORT.md)
> 分支：`{branch}`

## 1. Invariant（不变量）

{一句话断言：什么事实必须永远为真}

来源：DEFECT.md Delta 取反

## 2. Trigger Scenario（触发场景）

### Given
{前置状态}

### When
{操作步骤列表}

### Then
{期望断言}

**Level**: E2E
**来源**: DEFECT.md Path → 精简（参考 Root Cause 剔除冗余步骤）

## 3. Cause Anchor（根因锚点）

### 故障机制
{Root Cause 描述}

### 锚点断言
{在代码层面的具体断言}

**Level**: {Unit / Integration}
**来源**: FIX_REPORT.md Root Cause + Change

## 4. Boundary Set（边界集）

| # | 变体 | 来源 | Level | 状态 |
|---|------|------|-------|------|
| 1 | {描述} | {验证报告 / Root Cause 推导} | {E2E/Unit/Integration} | {✅/❌} |
| 2 | {描述} | {来源} | {Level} | {状态} |

## 5. Blast Shield（防爆盾）

| # | 区域 | 断言 | 来源 | Level | 状态 |
|---|------|------|------|-------|------|
| 1 | {区域名} | {回归断言} | {FIX_REPORT Blast Radius} | {Level} | {✅/❌} |

## 6. Coverage Matrix（覆盖矩阵）

| 守护元素 | 测试用例 | 文件 | 层级 | 状态 |
|---------|---------|------|------|------|
| Trigger Scenario | {test name} | {file path} | E2E | {✅/❌} |
| Cause Anchor | {test name} | {file path} | Unit | {✅/❌} |
| Boundary #1 | {test name} | {file path} | {Level} | {✅/❌} |
| Blast Shield #1 | {test name} | {file path} | {Level} | {✅/❌} |

## 7. Test Results（测试结果）

### 静态检查
- `make typecheck`：{通过/失败}
- `make test`：{通过/失败（N passed / M total）}

### 新增测试文件
| 文件 | 类型 | 用例数 |
|------|------|--------|
| {path} | {Unit/E2E} | {N} |

### Traceability（追溯）
```
origin: DEFECT.md
fixed_by: FIX_REPORT.md
verified_by: VERIFY_REPORT.md
guarded_by: 本报告
```

## 过程备注

{执行过程中捕获的学习信号。无则留空}
```

### 资源管理

所有产物统一放在 `.worktree/` 下：
```
.worktree/
├── DEFECT.md                           # 缺陷报告（输入）
├── DEFECT.assets/                      # 缺陷截图
├── FIX_REPORT.md                       # 修复报告（输入）
├── FIX_REPORT.assets/                  # 修复截图
├── VERIFY_REPORT.md                    # 验证报告（输入）
├── VERIFY_REPORT.assets/               # 验证截图
├── TEST_SPEC.md                        # 测试守护报告（输出）
└── merge.sh                            # 合并脚本
```

### 报告自检清单

- [ ] **Invariant**：来自 Delta 取反？能直接写 `expect()`？
- [ ] **Trigger Scenario**：Given/When/Then 完整？冗余步骤已剔除？
- [ ] **Cause Anchor**：在故障机制层面有断言？Level 合理？
- [ ] **Boundary Set**：经验变体 + 推理变体都有？半径不超过一步？
- [ ] **Blast Shield**：覆盖 Blast Radius 直接影响区域？
- [ ] **Coverage Matrix**：每个守护元素都有对应测试？无遗漏？
- [ ] **Test Results**：所有测试通过？
- [ ] **Traceability**：测试文件头部注释链接回三份报告？

### 3.3 生成合并脚本

guard 是完整链的最后一步，负责生成最终的 merge.sh（覆盖 verify 生成的版本）。

如果 `.worktree/meta.json` 存在（工作区模式），生成 `.worktree/merge.sh`：

```bash
#!/bin/bash
# 守护通过的合并脚本 — <工作区名称> → <baseBranch>
# 测试守护: TEST_SPEC.md
# 生成时间: <时间>
set -e

MAIN_REPO="<主仓库绝对路径>"
WT_NAME="<工作区名称>"
WT_PATH="$MAIN_REPO/.worktrees/$WT_NAME"

echo "🔀 合并 $WT_NAME → <baseBranch>"
make -C "$MAIN_REPO" wt-merge NAME="$WT_NAME"

# 合并后检测 schema 变更
if git -C "$MAIN_REPO" diff HEAD~1 --name-only | grep -qE "(drizzle/|db/schema\.ts)"; then
    echo ""
    echo "⚠️  检测到 schema 变更，请执行: make db-generate"
fi

# 归档报告链到上游 .worktree/sub-worktrees/<name>/
ARCHIVE_DIR="$MAIN_REPO/.worktree/sub-worktrees/$WT_NAME"
if [ -d "$WT_PATH/.worktree" ]; then
    mkdir -p "$ARCHIVE_DIR"
    cp -r "$WT_PATH/.worktree/"* "$ARCHIVE_DIR/"
    rm -f "$ARCHIVE_DIR/meta.json" "$ARCHIVE_DIR/merge.sh"
    echo ""
    echo "📦 报告链已归档到 .worktree/sub-worktrees/$WT_NAME/"
fi

echo ""
echo "✅ 合并完成"
echo "下一步（可选）："
echo "  make wt-delete NAME=$WT_NAME    # 删除工作区"
```

生成后设为可执行：`chmod +x .worktree/merge.sh`

### 3.4 流程

1. 运行测试
2. 生成报告内容，展示给用户
3. 用 `AskUserQuestion` 确认报告是否准确
4. 确认后写入 `.worktree/TEST_SPEC.md`
5. 生成 `merge.sh`（覆盖 verify 版本，含归档逻辑）
6. 启动 HTML 查看器

### 3.5 启动报告查看器

```bash
# 后台启动
node .claude/skills/test-guard/serve-report.mjs
# 用 Bash(run_in_background=true) 执行
```

查看器功能：
- **四栏 Tab 切换**：缺陷报告 | 修复报告 | 验证报告 | 测试守护
- **Verdict 顶部横幅**：✅/⚠️/❌ 合并裁定（来自验证报告）
- **Actions 区域**：
  - 上游 / 当前的实时 git 状态
  - Merge 按钮：两边都 clean + 无冲突 + 不落后上游时可用
  - Delete 按钮：合并成功后出现
- **图片内联**：报告中的截图直接显示

## 执行规则

1. **必须读完三份报告**：不凭空写测试，每个测试用例都能追溯到报告中的具体发现
2. **双层防护**：E2E 守症状 + Unit/Integration 守根因，缺一不可
3. **Trigger Scenario 必须精简**：只保留因果相关步骤，冗余步骤制造假阴性
4. **Cause Anchor 必须存在**：这是缺陷守护区别于普通测试的核心——在故障机制层面钉钉子
5. **Boundary Set 收敛**：围绕 Root Cause 画圆，半径不超过一步推导
6. **Blast Shield 定向**：只覆盖 Blast Radius 直接影响区域，不做全量回归
7. **静态检查不跳过**：`make typecheck` + `make test` 必须通过
8. **Traceability 必须完整**：每个测试文件头部注释链接回三份报告
9. **遵循项目测试约定**：CLAUDE.md 中所有 E2E、Testing 相关规则
10. **过程备注**：执行过程中遇到重试、惊讶、绕路、确认、环境等偏差信号时，记录到报告的「过程备注」节。格式：`[重试/惊讶/绕路/确认/环境] 简述`

## 推导路径总览

```
缺陷报告                修复报告               验证报告
────────                ────────               ────────
Delta ───────────────────────────────────────→ Invariant
  "什么坏了"                                     "什么不能再坏"

Path ─────────────────────────────────────→ Trigger Scenario
  "怎么触发"                                    Given/When/Then

                  Root Cause ─────────────────→ Cause Anchor
                    "为什么坏了"                    "根因层钉钉子"

                  Root Cause ──┐
                               ├──────────────→ Boundary Set
                  Boundary ────┘                 "同类变体"
                  Validation

                  Blast Radius ─┐
                                ├─────────────→ Blast Shield
                  Regression ───┘                "修复防爆"
                  Result
```

每个元素都有明确的推导来源，没有凭空发明的测试——这就是缺陷守护的力量：每个断言都能追溯到一次真实的事故。

## 与其他技能的协作

- **完整链条**：`/diagnose` → `/fix` → `/verify` → `/guard`（缺陷链路全四步）
- **在工作区中**：`/create-wt` → `/diagnose` → `/fix` → `/verify` → `/guard` → 合并
- **最后一道工序**：验证报告决定"能不能合并"，守护测试确保"合并后不复发"
