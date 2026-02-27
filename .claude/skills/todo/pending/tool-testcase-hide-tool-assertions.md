# Tool 测试用例断言不应该显示 Tool 组

AssertionRow 组件的断言类型下拉中，Tool 组（Tool Called / Tool Not Called / Tool Args Contains / Tool Args Exact）只在 Eval 场景有意义。Tool 测试用例直接执行 handler 函数，不涉及 AI 调用工具，应隐藏 Tool 组。

给 AssertionRow 加 `showToolAssertions` prop，Tool 测试用例传 false。
