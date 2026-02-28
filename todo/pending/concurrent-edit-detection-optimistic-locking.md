---
priority: P2
---
# 添加并发编辑检测（乐观锁）

所有 PATCH/PUT 端点使用 read-then-write 模式无版本检查，两个用户同时编辑同一资源时最后写入静默覆盖先前修改。

> Anchor: `web/src/app/api/tools/[id]/route.ts`、`web/src/app/api/model-configs/[id]/route.ts`
