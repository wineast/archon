---
priority: P1
---
# Embed Token 允许空 allowedOrigins 和通配符 * 绕过来源校验

## Symptom（看到了什么）
`require-embed-token.ts` 中 `allowedOrigins: []` 被视为"允许任何来源"，`o === "*"` 也直接放行。任意网站都能使用配置不当的 embed token。

## Trigger（怎么触发的）
代码审查发现。创建 embed token 时如果不填 allowedOrigins，默认空数组，安全检查形同虚设。

## Locale（大概在哪）
`web/src/lib/auth/require-embed-token.ts:44-55`

## Hypothesis（猜是什么原因）
早期为方便开发留的宽松逻辑。应禁止空 origins，禁止裸 `*`，仅支持 `*.domain.com` 格式的子域通配。
