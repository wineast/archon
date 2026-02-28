---
priority: P2
---
# Eval AI 辅助测试生成 + A/B 测试

Eval 框架完备但 FDE 无法轻松使用。需要：
1. AI 自动生成测试用例："导入 10 条真实用户对话 → 自动提取测试 case"
2. Eval 向导："Agent 应该做好什么？" → 生成 test cases + judge config
3. A/B 测试视图：同一 test set 对比新旧版本，显示胜率
4. 成本预估：运行 eval batch 前显示预计 token 消耗和费用
5. 失败深潜：测试失败时，标注是哪一步出了问题（工具失败？LLM 误解？格式错？）

> Anchor: `web/src/components/eval/`, `web/guide/eval.md`
