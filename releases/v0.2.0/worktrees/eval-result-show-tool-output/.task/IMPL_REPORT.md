# 实现报告：评估结果中展示工具调用输出

> 实现时间：2026-03-02 21:15
> 关联需求：[REQ.md](REQ.md)
> 分支：`dev-eval-result-show-tool-output-20260302`

## 1. Solution Design（方案设计）

### 用户流程
1. FDE 运行 eval 用例（flow 不变）
2. 查看结果时，每个工具调用行显示工具名 + 参数（现有行为不变）
3. 如果工具有返回结果，下方出现可折叠的 "Output" 标签
4. 点击 "Output" 展开查看完整输出内容
5. 再次点击折叠

### 系统架构
三层变更，自底向上：

```
类型层 (types.ts)
  └─ ChatMessage.toolCalls 增加 result?: unknown

数据层 (execute-case.ts)
  └─ 5 处 toolCalls.map() 保留 result（原先丢弃）

UI 层 (result-card.tsx)
  └─ ToolCallEntry 组件：工具名+参数 + 可折叠 Output
```

### 关键界面/接口

**ChatMessage.toolCalls 新结构：**
```typescript
toolCalls?: Array<{
  name: string;
  args: Record<string, unknown>;
  result?: unknown;  // 新增，向后兼容（可选字段）
}>;
```

**UI 折叠输出：** 使用原生 `<details>` 元素，无需额外状态管理。

## 2. Design Rationale（设计决策）

### 决策 1：使用原生 `<details>` 元素实现折叠
- **选择**：HTML 原生 `<details>` + `<summary>`
- **替代方案**：React state + 按钮切换 — 不选原因：需要为每个 tool call 维护独立 state，要么提取子组件要么用 Map，增加复杂度
- **选择依据**：原生折叠无需 JS 状态，行为一致，代码最简
- **已知妥协**：无

### 决策 2：提取 `ToolCallEntry` 组件消除重复
- **选择**：提取 `ToolCallEntry` 内部组件，单轮和多轮共用
- **替代方案**：两处分别内联修改 — 不选原因：重复代码，维护负担
- **选择依据**：DRY 原则，两处逻辑完全一致
- **已知妥协**：无

### 决策 3：result 字段类型用 `unknown` 而非 `string`
- **选择**：`result?: unknown`，展示时对 string 和 object 分别处理
- **替代方案**：强制 `string` — 不选原因：`ToolCallRecord.result` 本身就是 `unknown`（工具可以返回对象），强制转换会丢失结构
- **选择依据**：保持与 `ToolCallRecord` 类型一致，UI 层做 `typeof` 分支处理
- **已知妥协**：无

## 3. Change Set（变更集）

### 变更摘要
在 eval 运行时保留工具调用的返回结果（之前被丢弃），并在 ResultCard 中以可折叠方式展示。

### 修改
| 文件 | 改动 | 说明 |
|------|------|------|
| `web/src/lib/eval/types.ts:61` | `ChatMessage.toolCalls` 增加 `result?: unknown` | 类型兼容，旧数据无此字段不受影响 |
| `web/src/lib/eval/execute-case.ts:207` | single 模式 toolCalls map 增加 `result: tc.result` | 保留工具输出 |
| `web/src/lib/eval/execute-case.ts:227` | injected 模式注入轮 toolCalls map 增加 `result: tc.result` | 保留注入的工具输出 |
| `web/src/lib/eval/execute-case.ts:255` | injected 模式 AI 响应 toolCalls map 增加 `result: tc.result` | 保留工具输出 |
| `web/src/lib/eval/execute-case.ts:272` | sequential 模式注入轮 toolCalls map 增加 `result: tc.result` | 保留注入的工具输出 |
| `web/src/lib/eval/execute-case.ts:298` | sequential 模式 AI 响应 toolCalls map 增加 `result: tc.result` | 保留工具输出 |
| `web/src/components/eval/result-card.tsx` | 新增 `ToolCallEntry` 组件 + 替换两处 tool call 渲染 | 展示折叠输出，消除重复 |

### 新增
| 文件 | 说明 |
|------|------|
| `web/src/components/eval/__tests__/result-card.test.tsx` | ResultCard 工具输出展示测试（4 个用例） |

## 4. Traceability（需求追溯）

| 需求项 | 类型 | 实现位置 | 状态 |
|--------|------|----------|------|
| ChatMessage.toolCalls 包含可选 result 字段 | Acceptance | `types.ts:61` | ✅ 已实现 |
| chatMessages 中 assistant 消息的 toolCalls 包含 result 数据 | Acceptance | `execute-case.ts` 5处 | ✅ 已实现 |
| ResultCard 单轮模式可展开查看输出 | Acceptance | `result-card.tsx` ToolCallEntry | ✅ 已实现 |
| ResultCard 多轮模式可展开查看输出 | Acceptance | `result-card.tsx` ToolCallEntry | ✅ 已实现 |
| 工具输出默认折叠 | Acceptance | `<details>` 元素默认关闭 | ✅ 已实现 |
| 无工具输出时不显示展开入口 | Acceptance | `resultStr != null` 条件判断 | ✅ 已实现 |
| 现有 eval 流程、断言逻辑不受影响 | Acceptance | 未修改断言代码 | ✅ 已验证 |
| 展示运行时实际返回数据 | Constraint（业务） | 直接透传 result | ✅ 已满足 |
| 旧数据无 result 字段不报错 | Constraint（技术） | `result?: unknown` 可选 | ✅ 已满足 |
| 工具名称参数展示不变 | Constraint（现有行为） | ToolCallEntry 保持原有逻辑 | ✅ 已满足 |

## 5. Known Gaps（已知缺口）

### 未实现项
无

### 已知限制
- **历史数据**：已存在的 eval run 结果不会有 tool result（因为保存时就已丢弃），仅新运行的结果包含
- **大输出**：`max-h-[200px] overflow-auto` 限制了显示高度，超长输出需滚动查看

### 技术债务
无

## 验证结果

### 静态检查
- `make typecheck`：通过
- `make test`：通过，121 文件 1379 用例全部通过

### Acceptance 核对
| # | 验收标准 | 结果 |
|---|----------|------|
| 1 | ChatMessage.toolCalls 类型包含可选 result 字段 | ✅ |
| 2 | eval 运行后 chatMessages 中 toolCalls 包含 result 数据 | ✅ 单元测试验证 |
| 3 | ResultCard 单轮模式可展开查看输出 | ✅ 单元测试验证 |
| 4 | ResultCard 多轮模式可展开查看输出 | ✅ 单元测试验证 |
| 5 | 工具输出默认折叠 | ✅ `<details>` 默认关闭 |
| 6 | 无工具输出时不显示展开入口 | ✅ 单元测试验证 |
| 7 | 现有 eval 流程、断言逻辑不受影响 | ✅ 全量测试通过 |

### Constraint 合规
| # | 约束 | 结果 |
|---|------|------|
| 1 | 展示运行时实际返回数据，不做加工 | ✅ 未违反 |
| 2 | ChatMessage 向后兼容（可选字段） | ✅ 未违反 |
| 3 | 无 DB schema 迁移 | ✅ 未违反 |
| 4 | extractToolCalls 保留 result | ✅ 未违反 |
| 5 | 工具名称参数展示不变 | ✅ 未违反 |
| 6 | 断言逻辑不变 | ✅ 未违反 |
| 7 | 注入 toolCalls 处理不变 | ✅ 未违反 |

## 过程备注

无偏差信号。变更范围明确，实现顺畅。
