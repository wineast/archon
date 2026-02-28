---
priority: P2
---
# super_admin 跨组织访问无审计日志

## Symptom（看到了什么）
`require-org-role.ts` 中 super_admin 直接绕过所有角色检查返回 owner，无任何日志记录。被入侵或滥用时无法追溯。

## Trigger（怎么触发的）
代码审查发现。

## Locale（大概在哪）
`web/src/lib/auth/require-org-role.ts:31-33`

## Hypothesis（猜是什么原因）
早期开发便利设计。企业客户合规要求必须记录所有特权操作。应在 bypass 时写入 audit_logs 表。
