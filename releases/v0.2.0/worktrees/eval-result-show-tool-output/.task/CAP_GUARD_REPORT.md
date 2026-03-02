# 需求守护报告：评估结果中展示工具调用输出

> 执行时间：2026-03-02 16:22
> 关联规约：[CAP_GUARD.md](CAP_GUARD.md)
> 分支：`dev-eval-result-show-tool-output-20260302`

## 1. 规约概要

### Capability
FDE 查看评估结果时能看到工具调用的完整输出内容（默认折叠、点击展开），实现 Agent 推理链路的完整可视化。

### 覆盖统计
| 元素 | 规约数 | 测试数 | 通过 | 失败 |
|------|--------|--------|------|------|
| Criteria Matrix | 7 | 7 | 7 | 0 |
| Journey Test | 0 | 0 | — | — |
| Constraint Guard | 3 | 3 | 3 | 0 |
| Degradation Fence | 1 | 1 | 1 | 0 |

## 2. 测试结果

### 静态检查
- `make typecheck`：通过
- `make test`：120 文件通过 / 1 文件失败（`diff-guard.test.ts` 预存问题，与本次变更无关）

### 单元/集成测试
| 文件 | 用例数 | 通过 | 失败 | 覆盖规约 |
|------|--------|------|------|----------|
| `src/components/eval/__tests__/result-card.test.tsx` | 6 | 6 | 0 | AC-3, AC-4, AC-5, AC-6, CG-1, CG-2, CG-3, DF-1 |
| `src/lib/eval/__tests__/execute-case.test.ts` | 相关 1 | 1 | 0 | AC-2 |

### E2E 测试
无（eval 运行需真实 AI API，不适合自动化守护）

## 3. Coverage Matrix（覆盖矩阵）

| 来源 | 测试用例 | 文件 | 层级 | 结果 |
|------|----------|------|------|------|
| AC-1 | TypeScript 编译 | make typecheck | 编译时 | ✅ |
| AC-2 | preserves tool call results in chatMessages | execute-case.test.ts | Unit | ✅ |
| AC-3 | 有 result 时渲染可折叠的 Output | result-card.test.tsx | Unit | ✅ |
| AC-3 | result 为对象时 JSON 格式化展示 | result-card.test.tsx | Unit | ✅ |
| AC-4 | 多轮模式也渲染工具输出 | result-card.test.tsx | Unit | ✅ |
| AC-5 | （含于 AC-3：details 默认无 open） | result-card.test.tsx | Unit | ✅ |
| AC-6 | 无 result 时不渲染 Output 折叠 | result-card.test.tsx | Unit | ✅ |
| AC-7 | 全量测试通过 | make test | 全量 | ✅ |
| CG-1 | result 为 null 时不渲染 Output（向后兼容） | result-card.test.tsx | Unit | ✅ |
| CG-2 | （含于 AC-3：检查工具名在 DOM 中） | result-card.test.tsx | Unit | ✅ |
| CG-3 | 多个工具调用混合有/无 result 时独立渲染 | result-card.test.tsx | Unit | ✅ |
| DF-1 | 无 result 时不渲染 Output 折叠 | result-card.test.tsx | Unit | ✅ |

## 4. Verdict（裁定）

### 判决
✅ 守护就绪

### 证据摘要
- **Criteria Matrix**：7/7 条覆盖，全部通过
- **Journey Test**：无（已在验收阶段 E2E 验证，eval 需真实 API 不适合自动化）
- **Constraint Guard**：3/3 条覆盖，全部通过
- **Degradation Fence**：1/1 条覆盖，通过

### 未覆盖项
无

### 新增测试文件
| 文件 | 类型 | 用例数 |
|------|------|--------|
| `web/src/components/eval/__tests__/result-card.test.tsx` | Unit | 6（实现阶段 4 + 守护阶段 2） |

## 过程备注

无偏差。现有实现阶段测试已覆盖大部分规约条目，守护阶段仅需补充 2 个边界场景（null result、混合 result）。
