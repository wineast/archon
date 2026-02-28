---
priority: P3
---
# 给 external-proxy 添加 SSRF 防护

`proxyToExternal` 接受配置中的 URL 发起服务端请求但无内网/私有 IP 地址校验，攻击者可构造指向内网服务的 URL 进行 SSRF 攻击。

> Anchor: `web/src/lib/ontology/external-proxy.ts`
