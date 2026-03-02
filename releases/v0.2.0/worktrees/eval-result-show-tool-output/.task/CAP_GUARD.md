# 需求守护规约：评估结果中展示工具调用输出

> 生成时间：2026-03-02 16:22
> 关联需求：[REQ.md](REQ.md)
> 关联实现：[IMPL_REPORT.md](IMPL_REPORT.md)
> 关联验收：[ACCEPT_REPORT.md](ACCEPT_REPORT.md)
> 分支：`dev-eval-result-show-tool-output-20260302`

## 1. Capability（能力宣言）

FDE 查看评估结果时，能看到每个工具调用的完整输出内容（默认折叠，点击展开），从而理解 Agent 的完整推理链路。工具输出在 eval 运行时被保留（不再丢弃），在 ResultCard 中以可折叠方式展示。

## 2. Criteria Matrix（标准矩阵）

| # | 验收标准 | Given | When | Then | Level | Boundaries |
|---|----------|-------|------|------|-------|------------|
| AC-1 | ChatMessage.toolCalls 包含可选 result 字段 | 类型定义 | TypeScript 编译 | 编译通过 | 编译时 | — |
| AC-2 | eval 运行后 toolCalls 包含 result 数据 | generateText 返回含 toolResults 的 steps | executeCase 执行 | chatMessages[1].toolCalls 包含 result | Unit | 多工具调用各有不同类型 result |
| AC-3 | 单轮模式可展开查看输出 | ResultCard 渲染含 result 的 toolCalls | 查看渲染结果 | 出现 data-testid="tool-output" 的 details 元素，pre 内含输出文本 | Unit | string result / object result |
| AC-4 | 多轮模式可展开查看输出 | ResultCard 渲染 injected 模式数据 | 查看渲染结果 | 同 AC-3 | Unit | — |
| AC-5 | 工具输出默认折叠 | AC-3 场景 | 初始渲染 | details 元素无 open 属性（原生 `<details>` 默认关闭） | Unit | — |
| AC-6 | 无 result 时不显示展开入口 | toolCalls 无 result 字段 | 渲染 | 无 tool-output testid 元素 | Unit | result=undefined / result=null |
| AC-7 | 现有 eval 流程不受影响 | 标准 eval 流程 | 运行断言 | 断言逻辑未修改，现有测试通过 | 全量测试 | — |

## 3. Journey Test（旅程测试）

无。原因：eval 运行需要真实 AI API 调用（DeepSeek 等），不适合作为自动化守护测试。单元测试已覆盖全部渲染路径和数据透传逻辑。E2E 验证已在验收阶段完成（截图取证）。

## 4. Constraint Guard（约束守卫）

| # | 约束 | Given | When | Then | Level |
|---|------|-------|------|------|-------|
| CG-1 | 向后兼容：旧数据无 result 不报错 | toolCalls 无 result 或 result=null | 渲染 ResultCard | 正常渲染，不显示 Output 折叠，无报错 | Unit |
| CG-2 | 工具名称参数展示不变 | toolCalls 含 name+args+result | 渲染 ResultCard | name 和 args 正常展示 | Unit |
| CG-3 | 混合场景：部分有 result 部分无 | 3 个 toolCalls，2 有 result 1 无 | 渲染 | 有 result 的 2 个显示 Output，无的不显示 | Unit |

## 5. Degradation Fence（退化围栏）

| # | Known Gap | 底线 | Given | When | Then | Level |
|---|-----------|------|-------|------|------|-------|
| DF-1 | 历史数据无 result | 旧数据正常显示工具名+参数 | toolCalls 只有 name+args | 渲染 | 工具名参数正常，无 Output 入口 | Unit |

## 6. Coverage Matrix（覆盖矩阵）

| 来源 | 测试用例 | 文件 | 层级 | 状态 |
|------|----------|------|------|------|
| AC-1 | TypeScript 编译 | make typecheck | 编译时 | ✅ |
| AC-2 | preserves tool call results in chatMessages | execute-case.test.ts | Unit | ✅ |
| AC-3 | 有 result 时渲染可折叠的 Output | result-card.test.tsx | Unit | ✅ |
| AC-3 | result 为对象时 JSON 格式化展示 | result-card.test.tsx | Unit | ✅ |
| AC-4 | 多轮模式也渲染工具输出 | result-card.test.tsx | Unit | ✅ |
| AC-5 | （含于 AC-3 测试：details 默认无 open） | result-card.test.tsx | Unit | ✅ |
| AC-6 | 无 result 时不渲染 Output 折叠 | result-card.test.tsx | Unit | ✅ |
| AC-7 | 全量测试通过 | make test | 全量 | ✅ |
| CG-1 | result 为 null 时不渲染 Output（向后兼容） | result-card.test.tsx | Unit | ✅ |
| CG-2 | （含于 AC-3 测试：检查工具名在 DOM 中） | result-card.test.tsx | Unit | ✅ |
| CG-3 | 多个工具调用混合有/无 result 时独立渲染 | result-card.test.tsx | Unit | ✅ |
| DF-1 | 无 result 时不渲染 Output 折叠 | result-card.test.tsx | Unit | ✅ |
