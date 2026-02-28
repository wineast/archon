---
priority: P2
---
# 接入真实支付系统（替换伪支付）

积分充值接口是"伪支付"——org admin 可以无验证地给自己加积分（代码注释写着 "pseudo-payment"）。收费模型落地需要：
1. 接入 Stripe/支付宝/微信支付
2. 支付验证后才更新积分
3. Webhook 接收支付状态回调
4. 发票/收据生成
5. 计费对账机制

> Anchor: `web/src/app/api/orgs/[id]/credits/route.ts:45-87`
