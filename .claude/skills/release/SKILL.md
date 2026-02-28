---
name: release
description: 发布检查。当用户说"发布"、"release"、"发布检查"、"可以发布吗"、"创建发布 PR"等时调用。读取集成报告，执行回归验证和交叉功能验证，生成发布检查报告并创建 PR。
allowed-tools: AskUserQuestion, Read, Grep, Glob, Task, Bash, Write, Edit, mcp__playwright__*
---

读取集成报告 → 五维度发布检查 → 生成发布报告 → 创建 PR → 启动 HTML 预览。

## 核心理念

集成报告是"货运清单"，发布检查是"质检报告 + 放行单"。

与 accept/verify 的本质区别：accept/verify 审判单个功能/修复的质量，release 审判整批变更的集成质量——重点不是每个零件合不合格（子工作区已验收/验证），而是装配在一起能不能跑。

### 三份文档的角色

```
集成报告    → 货运清单（这批货有什么）
发布报告    → 质检报告（这批货能不能出厂）
PR          → 出货单（正式发货）
```

### 与验收/验证报告的维度对比

```
验收报告（单功能）           发布报告（整批集成）
────────────────            ────────────────
Criteria（标准对不对）       Regression（基线稳不稳）
Experience（用得顺不顺）     Cross-feature（组装配不配）
Gap（缺口要不要紧）         Migration（迁移安不安全）
Regression（旧的坏没坏）    Release Notes（说得清不清）
Verdict（合不合并）          Verdict（发不发布）
```

### 五不可约元素（发布种子）

| 元素 | 含义 |
|-----|------|
| **Regression** (回归) | typecheck + test 全量通过 |
| **Cross-feature** (交叉验证) | 多功能协同场景 |
| **Migration** (迁移安全) | schema/格式变更可控 |
| **Release Notes** (发布说明) | 结构化的用户向变更日志 |
| **Verdict** (裁定) | ✅ 发布 / ⚠️ 有条件发布 / ❌ 阻塞 |

## Phase 0: 读取集成报告

### 操作

1. 读取 `.worktree/INTEGRATE.md`，提取四要素：
   - **Scope**：包含的工作区、commit 范围
   - **Additions**：新功能 + 缺陷修复
   - **Breaking**：Schema/API/行为变更
   - **Risk**：跨功能交互、未闭合缺口

2. 如果 `.worktree/INTEGRATE.md` 不存在，提示用户先运行 `/integrate`

3. 向用户简要复述集成报告要点，进入发布检查

## Phase 1: Regression（回归验证）

### 目标
确认整批变更没有弄坏基线。

### 操作

#### 1.1 静态检查
```bash
make typecheck
make test
```

#### 1.2 Schema 变更检测
- 如果集成报告的 Breaking 中有 Schema 变更：
  ```bash
  # 检查是否需要生成迁移文件
  git diff main..dev --name-only -- 'web/src/db/schema.ts'
  ls drizzle/
  ```
- dev 分支合并到 main 前需要 `make db-generate`，检查是否已生成

#### 1.3 判定
- **通过**：静态检查全量通过
- **未通过**：有 typecheck 错误或测试失败

## Phase 2: Cross-feature（交叉验证）

### 目标
验证不同工作区的变更在同一系统中协同运行时不会冲突。

### 操作

#### 2.1 检查环境
检查 dev 服务器是否在运行：
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:{端口号} 2>/dev/null
```
如果存在 `.worktree/meta.json`，从中读取端口号；否则使用默认 3000。

如果未运行：`make up`（`run_in_background=true`），轮询等待就绪，**最多 15s**。超时则 `make down` + `make up` 重启，仍失败则报错给用户。

#### 2.2 从集成报告 Risk 推导验证场景
- 读取 INTEGRATE.md 的 Risk 部分
- 识别跨功能交互风险点
- 设计 2-3 个交叉验证场景（覆盖不同工作区的变更交汇处）

#### 2.3 用 Playwright 验证
- 对每个场景端到端走通
- 关注点：功能 A 和功能 B 同时使用时是否正常、数据是否一致、UI 是否冲突

#### 2.4 判定
- **通过**：所有交叉场景正常
- **部分通过**：核心场景通过但有边缘冲突
- **未通过**：发现功能间冲突

### 截图命名
- `.worktree/RELEASE_REPORT.assets/release-cross-{N}.png`

## Phase 3: Migration（迁移安全）

### 目标
确认 schema/格式变更在发布过程中安全可控。

### 操作

#### 3.1 Schema 变更
- 读取集成报告的 Breaking → Schema 变更
- 如有变更：检查 `drizzle/` 目录的迁移文件是否完整
- 评估迁移风险：新增列（安全） vs 删除列（危险） vs 类型变更（需评估）

#### 3.2 Migration 文件完整性
- 如果 schema 有变更但无迁移文件 → 需要 `make db-generate`
- 如果已有迁移文件 → 检查是否与 schema 一致

#### 3.3 导出格式兼容性
- 如果集成报告的 Breaking 中有导出格式变更
- 评估旧格式数据是否仍可导入

#### 3.4 判定
- **安全**：无 schema 变更 / 迁移文件完整且安全
- **需注意**：有 schema 变更但影响可控
- **阻塞**：迁移文件缺失 / 存在危险的 schema 变更

## Phase 4: 生成 Release Notes + 报告 + 创建 PR

### Release Notes
从集成报告的 Additions 推导面向用户的变更日志：
- 新功能：从 REQ.md 的 What 翻译为用户语言
- 缺陷修复：从 DEFECT.md 的 Delta 翻译为用户语言
- 其他：chore/refactor 归类

### Verdict 裁定规则

```
Regression 通过 + Cross-feature 通过 + Migration 安全
  → ✅ 发布

Regression 通过 + Cross-feature 部分通过 + Migration 需注意
  → ⚠️ 有条件发布（列出条件）

Regression 未通过 / Cross-feature 未通过 / Migration 阻塞
  → ❌ 阻塞（列出阻塞项）
```

### 资源管理

所有发布检查产物统一放在 `.worktree/` 下：
```
.worktree/
├── INTEGRATE.md                       # 集成报告（输入）
├── RELEASE_REPORT.md                  # 发布检查报告（输出）
├── RELEASE_REPORT.assets/             # 发布检查截图
│   └── release-cross-{N}.png
└── sub-worktrees/                     # 子工作区归档（输入）
```

### 报告模板

```markdown
# 发布检查报告：{版本/摘要}

> 检查时间：{YYYY-MM-DD HH:mm}
> 关联集成：[INTEGRATE.md](INTEGRATE.md)
> 分支：`dev` → `main`

## 1. Regression（回归验证）

### 静态检查
- `make typecheck`：{通过/失败}
- `make test`：{通过/失败（N 文件 / M 用例）}

### 结果
{✅ 通过 / ❌ 未通过}

## 2. Cross-feature（交叉验证）

### 验证场景
| 场景 | 涉及功能 | 结果 |
|------|---------|------|
| {场景描述} | {功能 A + 功能 B} | ✅/❌ |

### 证据
| 验证项 | 截图 |
|--------|------|
| {场景} | ![cross](RELEASE_REPORT.assets/release-cross-{N}.png) |

### 结果
{✅ 通过 / ⚠️ 部分通过 / ❌ 未通过}

## 3. Migration（迁移安全）

### Schema 变更
{有/无 + 详情}

### Migration 文件
{检查 drizzle/ 目录是否需要生成}

### 导出格式兼容性
{有/无破坏性变更}

### 结果
{✅ 安全 / ⚠️ 需注意 / ❌ 阻塞}

## 4. Release Notes（发布说明）

### 新功能
- {功能 1}

### 缺陷修复
- {修复 1}

### 其他
- {chore/refactor}

## 5. Verdict（裁定）

### 判决
{✅ 发布 / ⚠️ 有条件发布 / ❌ 阻塞}

### 证据摘要
- **Regression**：{一句话}
- **Cross-feature**：{一句话}
- **Migration**：{一句话}

### 阻塞项
{必须修复后才能发布的问题。无则写"无"}

### Follow-up 清单
{发布后需跟进的事项。无则写"无"}
```

### 报告自检清单

- [ ] **Regression**：`make typecheck` + `make test` 都跑了吗？
- [ ] **Cross-feature**：从 Risk 推导的场景都验了吗？截图附了吗？
- [ ] **Migration**：Schema 变更检查了吗？迁移文件完整吗？
- [ ] **Release Notes**：覆盖了所有 Additions 吗？面向用户可读吗？
- [ ] **Verdict**：证据摘要覆盖三项吗？阻塞项和 Follow-up 列清楚了吗？

### 创建 PR

Verdict 为 ✅ 或 ⚠️ 时创建 PR：

```bash
gh pr create --base main --head dev --title "{PR 标题}" --body "$(cat <<'EOF'
## Verdict

{✅ 发布 / ⚠️ 有条件发布}

## Changes

### 新功能
{从 Release Notes 复制}

### 缺陷修复
{从 Release Notes 复制}

### 其他
{从 Release Notes 复制}

## Breaking Changes
{从集成报告的 Breaking 复制。无则写"无"}

## Verification
- **Regression**: {一句话}
- **Cross-feature**: {一句话}
- **Migration**: {一句话}
- **Report**: [RELEASE_REPORT.md](.worktree/RELEASE_REPORT.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 启动报告查看器

```bash
# 后台启动
node .claude/skills/release/serve-report.mjs
# 用 Bash(run_in_background=true) 执行
```

查看器功能：
- **链路指示器**：集成报告 → 发布检查
- **双栏 Tab 切换**：集成报告 | 发布检查
- **Verdict 顶部横幅**：✅/⚠️/❌ 发布裁定
- **Actions 区域**：
  - 上游 / 当前的实时 git 状态
  - Merge 按钮：两边都 clean + 无冲突 + 不落后上游时可用
  - Delete 按钮：合并成功后出现
- **图片内联**：报告中的截图直接显示

### 流程

1. 读取集成报告，向用户复述要点
2. 执行 Phase 1-3 的检查
3. 生成报告内容，展示给用户
4. 用 `AskUserQuestion` 确认报告是否准确
5. 确认后写入 `.worktree/RELEASE_REPORT.md`
6. 如果 Verdict 为 ✅ 或 ⚠️，创建 PR
7. 启动 HTML 查看器，提示用户在浏览器中查看和操作

## 执行规则

1. **集成报告先行**：必须读取 INTEGRATE.md 作为输入，不从零开始分析
2. **回归必须全量**：`make typecheck` + `make test` 不可跳过
3. **交叉验证不能省**：即使每个子工作区都通过了验收/验证，组合后仍需验证
4. **迁移安全是硬约束**：Schema 变更缺少迁移文件 → 阻塞发布
5. **Release Notes 面向用户**：不是开发者 changelog，是用户能看懂的变更说明
6. **Verdict 有理有据**：判决必须基于三项检查证据
7. **PR 格式规范**：遵循现有 PR body 格式（Verdict / Changes / Breaking Changes / Verification）
8. **截图取证**：交叉验证场景必须截图

## 与其他技能的协作

- **完整链条**：`/integrate` → 集成报告 → `/release` → 发布检查 → PR → 合并
- **上游依赖**：必须先有 INTEGRATE.md（由 `/integrate` 生成）
- **PR 创建**：Verdict 为 ✅ 或 ⚠️ 时自动创建 PR
- **与 `/accept`、`/verify` 的区别**：accept/verify 审判单个功能/修复，release 审判整批集成
