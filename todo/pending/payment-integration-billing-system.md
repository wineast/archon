---
priority: P2
---
# 接入真实支付系统（替换伪支付）

积分充值接口是伪支付（org admin 可无验证加积分），收费模型落地需接入 Stripe/支付宝/微信支付并加 webhook 回调验证。

> Anchor: `web/src/app/api/orgs/[id]/credits/route.ts:45-87`
