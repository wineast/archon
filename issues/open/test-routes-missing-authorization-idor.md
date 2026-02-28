---
priority: P1
---
# 18+ 个 test-case/test-run 路由缺少授权检查存在 IDOR 漏洞

## Symptom（看到了什么）
18+ 个 test-case/test-run 路由（tools/functions/components/schemas 下的 test-cases、test-runs 子路由）没有 `requireAgentRole` 授权检查，任何已认证用户可对任意资源的测试用例进行 CRUD 操作。

## Trigger（怎么触发的）
已认证用户猜测或枚举资源 UUID，通过 GET/POST/PUT/DELETE 操作其他用户的测试用例。

## Locale（大概在哪）
`web/src/app/api/tools/[id]/test-cases/`、`test-runs/` 及同级 functions/components/schemas 下的同名路由，共 18+ 个路由文件。

## Hypothesis（猜是什么原因）
这些路由在创建时遗漏了授权检查。特别是 `test-cases/run` 路由会执行数据库中存储的代码（tool handler / function code），结合 IDOR 可执行其他用户的代码。需要在所有路由入口添加 `requireAgentRole`。
