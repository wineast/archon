---
priority: P3
---
# 清理 tools 表 is_system 与 origin 的语义重叠

`is_system` 和 `origin="builtin"` 语义重叠。统一用 `origin` 判断系统内置工具，移除 `is_system` 字段，排查代码中所有 `is_system` 引用并迁移到 `origin` 判断。

> Anchor: `web/src/db/schema.ts` (tools 表)
