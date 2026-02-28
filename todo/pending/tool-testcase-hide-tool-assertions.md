---
priority: P2
---
# Tool 测试用例断言不应该显示 Tool 组

Tool 测试用例直接执行 handler 函数不涉及 AI 调用，AssertionRow 的 Tool 组断言类型（Tool Called/Not Called/Args 等）应隐藏，给 AssertionRow 加 `showToolAssertions` prop 控制。

> Anchor: `web/src/components/eval/assertion-row.tsx`
