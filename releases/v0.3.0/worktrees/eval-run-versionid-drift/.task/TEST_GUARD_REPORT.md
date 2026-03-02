# 测试守护报告：Eval run case 执行使用快照 versionId

> 执行时间：2026-03-02 12:30
> 关联规约：[TEST_GUARD.md](TEST_GUARD.md)
> 分支：`dev-eval-run-versionid-drift-20260302`

## 1. 规约概要

### Invariant
Eval run 的所有 case 必须使用 run 创建时快照的 versionId 加载 tools 和 templateData，不可实时查询当前编辑版本。

### 覆盖统计
| 元素 | 规约数 | 测试数 | 通过 | 失败 |
|------|--------|--------|------|------|
| Cause Anchor | 3 | 3 | 3 | 0 |
| Boundary Set | 3 | 3 | 3 | 0 |
| Blast Shield | 3 | 3 | 3 | 0 |

## 2. 测试结果

### 静态检查
- `make typecheck`：通过
- `make test`：通过（122 文件 / 1390 用例）

### 单元测试
| 文件 | 用例数 | 通过 | 失败 | 覆盖规约 |
|------|--------|------|------|----------|
| `src/lib/eval/__tests__/execute-case-versionid.guard.test.ts` | 9 | 9 | 0 | Cause Anchor 1-3, Boundary 1-3, Blast Shield 1-3 |

## 3. Coverage Matrix（覆盖矩阵）

| 守护元素 | 测试用例 | 文件 | 层级 | 结果 |
|---------|---------|------|------|------|
| Cause Anchor #1 | execute-case.ts 不 import resolveEditingVersionId | execute-case-versionid.guard.test.ts | Unit | ✅ |
| Cause Anchor #2 | gatherTemplateData 接收 run.chatVersionId | execute-case-versionid.guard.test.ts | Unit | ✅ |
| Cause Anchor #3 | 不同 run 使用各自快照的 chatVersionId | execute-case-versionid.guard.test.ts | Unit | ✅ |
| Boundary #1 | chatVersionId = null 时 gatherTemplateData 收到 undefined | execute-case-versionid.guard.test.ts | Unit | ✅ |
| Boundary #2 | chatVersionId = null 时不查询 tools | execute-case-versionid.guard.test.ts | Unit | ✅ |
| Boundary #3 | chatVersionId = null 时不报错 | execute-case-versionid.guard.test.ts | Unit | ✅ |
| Blast Shield #1 | single 模式正常执行 | execute-case-versionid.guard.test.ts | Unit | ✅ |
| Blast Shield #2 | injected 模式正常执行 | execute-case-versionid.guard.test.ts | Unit | ✅ |
| Blast Shield #3 | sequential 模式正常执行 | execute-case-versionid.guard.test.ts | Unit | ✅ |

## 4. Verdict（裁定）

### 判决
✅ 守护就绪

### 证据摘要
- **Cause Anchor**：3/3 通过——源码级断言确认 resolveEditingVersionId 已移除，gatherTemplateData 使用快照值
- **Boundary Set**：3/3 通过——null chatVersionId 安全降级（空 templateData、跳过 tools 查询、不报错）
- **Blast Shield**：3/3 通过——single/injected/sequential 三种模式均正常工作

### 未覆盖项
无

### Traceability（追溯）
```
origin: DEFECT.md
fixed_by: FIX_REPORT.md
verified_by: VERIFY_REPORT.md
guarded_by: TEST_GUARD.md + 本报告
```

### 新增测试文件
| 文件 | 类型 | 用例数 |
|------|------|--------|
| `web/src/lib/eval/__tests__/execute-case-versionid.guard.test.ts` | Unit | 9 |

## E2E 回归验证

虽然竞态条件本身无法在 E2E 中精确复现（需要在 eval run 期间切换版本，时序不可控），但通过以下方式确认修复后 eval 功能完整可用：

### 自动化 E2E
- `eval-flow.spec.ts`：2 tests passed (1.2min)——完整 eval 生命周期（创建 Agent → 配置模型 → 创建 case → Run All → 验证结果）

### 手动 Playwright 验证
- 登录 → E2E Test Agent → Build → Evaluate → Run All → 1/1 通过，Judge 10/10

| 验证项 | 截图 |
|--------|------|
| Eval 运行完成（手动） | ![run](VERIFY_REPORT.assets/verify-versionid-regression-eval-run.png) |

## 过程备注

- [确认] E2E 守护因竞态条件复现成本过高被跳过——触发需要在 eval run 期间精确切换版本，时序不可控。Unit 层的 Cause Anchor（源码字符串断言 + mock 验证）已充分覆盖根因防线
- [确认] 源码字符串断言（`readFileSync` + `not.toContain("resolveEditingVersionId")`）是最强的 Cause Anchor——直接防止有人重新引入实时查询
- [补充] E2E 回归验证已补充——自动化 `eval-flow.spec.ts` 通过 + 手动 Playwright 走完 eval 流程并截图取证
