# 测试守护报告：Judge systemPrompt 使用 judge agent 自身的 templateData

> 执行时间：2026-03-03 21:25
> 关联规约：[TEST_GUARD.md](TEST_GUARD.md)
> 分支：`dev-eval-judge-system-prompt-uses-wrong-template-data-20260303`

## 1. 规约概要

### Invariant
Judge systemPrompt 必须使用 judge agent 自身的 templateData 渲染，不可使用被评估 agent 的 templateData。

### 覆盖统计
| 元素 | 规约数 | 测试数 | 通过 | 失败 |
|------|--------|--------|------|------|
| Cause Anchor | 2 | 2 | 2 | 0 |
| Boundary Set | 3 | 3 | 3 | 0 |
| Blast Shield | 2 | 3 | 3 | 0 |

## 2. 测试结果

### 静态检查
- `make typecheck`：通过
- `make test`（eval 相关 9 文件 / 151 用例）：全部通过

### 单元测试
| 文件 | 用例数 | 通过 | 失败 | 覆盖规约 |
|------|--------|------|------|----------|
| `src/lib/eval/__tests__/execute-case-judge-templatedata.guard.test.ts` | 8 | 8 | 0 | Cause Anchor, Boundary 1-3, Blast Shield 1-2 |

## 3. Coverage Matrix（覆盖矩阵）

| 守护元素 | 测试用例 | 文件 | 层级 | 结果 |
|---------|---------|------|------|------|
| Cause Anchor | gatherTemplateData 被调用两次：eval agent + judge agent | guard test | Unit | ✅ |
| Cause Anchor | renderTemplate 渲染 judge systemPrompt 时接收 judge templateData | guard test | Unit | ✅ |
| Boundary #1 | judgeVersionId=null 时 gatherTemplateData 收到 undefined | guard test | Unit | ✅ |
| Boundary #2 | judgeAgentId=null 时 gatherTemplateData 收到 undefined | guard test | Unit | ✅ |
| Boundary #3 | sequential 模式 per-turn judge 同样使用 judge templateData | guard test | Unit | ✅ |
| Blast Shield #1 | chat systemPrompt 渲染使用 eval agent 的 templateData | guard test | Unit | ✅ |
| Blast Shield #2 | finally 中 disposeTemplateData 对两份 templateData 都调用 | guard test | Unit | ✅ |
| Blast Shield #2+ | executeCase 异常时两份 templateData 仍被 dispose | guard test | Unit | ✅ |

## 4. Verdict（裁定）

### 判决
✅ 守护就绪

### 证据摘要
- **Cause Anchor**：通过——gatherTemplateData 分别为 eval/judge 调用，renderTemplate 传入正确数据验证
- **Boundary Set**：3/3 通过——null 安全降级 + sequential per-turn judge 覆盖
- **Blast Shield**：3/3 通过——chat 数据流隔离 + 资源释放（正常 + 异常路径）

### 未覆盖项
无。E2E 层级的 Trigger Scenario 未编写——本 bug 为纯后端数据流逻辑，无 UI 表征，Unit 层级已充分覆盖双层防护（Cause Anchor 直接锚定根因机制 + Boundary/Blast Shield 覆盖变体和影响面）。

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
| `web/src/lib/eval/__tests__/execute-case-judge-templatedata.guard.test.ts` | Unit (Guard) | 8 |

## 过程备注

无
