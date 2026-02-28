---
priority: P2
---
# 启动 SOC 2 合规路线图

75% 企业领导者将安全合规列为 AI 部署首要关注。Stack AI/Botpress 已有 SOC 2 Type II。需要：
1. 审计日志完善（当前 super_admin 无日志）
2. 数据加密全覆盖（API key 加密已有，但密钥轮换缺失）
3. 访问控制细化（RBAC 已有基础，需增强）
4. 安全漏洞修复（embed token 来源校验、版本发布越权检查等）
5. 启动 SOC 2 Type I 认证流程

企业客户（尤其金融、医疗行业）要求合规是准入门槛。

> Anchor: `web/src/lib/auth/`, `web/src/db/schema.ts`（audit_logs 表）
