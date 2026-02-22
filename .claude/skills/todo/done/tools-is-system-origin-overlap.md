# tools 表 is_system 与 origin 语义重叠清理

`is_system` 和 `origin="builtin"` 语义重叠。建议统一用 `origin` 判断系统内置工具，移除 `is_system` 字段。需排查代码中所有 `is_system` 引用并迁移到 `origin` 判断。
