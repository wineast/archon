---
priority: P2
---
# API Key 遮罩显示使用加密后的后 4 位而非原始 key

## Symptom（看到了什么）
`/api/orgs/[id]/api-keys` 返回 `maskedKey: "****" + encryptedKey.slice(-4)`，泄露的是加密后的密文尾部，而非原始 API key 的后 4 位。虽然密文本身不可直接利用，但违反纵深防御原则。

## Trigger（怎么触发的）
代码审查发现。

## Locale（大概在哪）
`web/src/app/api/orgs/[id]/api-keys/route.ts:38`

## Hypothesis（猜是什么原因）
实现时混淆了 encryptedKey 和原始 key。应在加密前保存后 4 位到单独字段（如 `lastFour`），或用随机标识符替代。
