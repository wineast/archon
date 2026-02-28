---
priority: P1
---
# 给 LiquidJS 引擎实例添加迭代次数限制

当前所有 `new Liquid({ jsTruthy: true })` 实例未配置 `limits` 选项。用户可在模板中写 `{% for i in (1..999999999) %}` 导致 CPU 耗尽和内存溢出，影响服务器稳定性。需要在所有 Liquid 实例初始化时添加 `limits: { maxIterations: N }` 配置，合理值如 1000-5000 次迭代。

> Anchor: `web/src/lib/wiki/template.ts:39`、`web/src/lib/datasets/queries.ts:8`、`web/src/lib/eval/judge-prompt.ts:5`
