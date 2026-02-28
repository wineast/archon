---
priority: P1
---
# code-scanner 解析失败时返回通过，存在多个绕过向量

## Symptom（看到了什么）
`code-scanner.ts` 在 acorn 解析代码失败时返回 `{ ok: true, errors: [] }`，等于允许所有无法被 acorn 解析的代码通过安全扫描。此外 constructor 的 bracket notation 访问、缺少对 fetch/Reflect/Proxy 的禁止、以及 `this` 关键字未阻止等多个绕过向量。

## Trigger（怎么触发的）
提交包含非标准语法或混淆后的恶意代码到工具 handler。

## Locale（大概在哪）
`web/src/lib/code-scanner.ts`（第 41-44 行 parse failure，FORBIDDEN_GLOBALS 缺失 fetch/Reflect/Proxy 等）

## Hypothesis（猜是什么原因）
parse failure 应改为 `ok: false`；FORBIDDEN_GLOBALS 需扩展；需检测 bracket notation 的 constructor 访问；需强制 strict mode 或阻止 `this`。
