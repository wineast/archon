---
priority: P2
---
# 一键发布 + 发布前健康检查

发布需要 Build > Versions tab > 选版本 > 发布动作，流程冗长。需要：
1. Agent 详情头部"立即发布"快捷操作
2. 发布前自动校验：工具是否配置完整、模型是否选择、引用是否有效
3. 发布变更日志：对比当前线上版本 vs 即将发布版本的差异
4. 发布后状态提示："已上线 v1.2.3" 醒目展示
5. 一键回滚：显眼的"回退到上一版本"按钮

> Anchor: `web/src/app/api/agents/[id]/versions/[versionId]/publish/route.ts`, `web/guide/version-system.md`
