# Schema 引用缺少版本隔离

- **类型**: cleanup
- **优先级**: medium
- **发现日期**: 2026-02-19
- **工作区**: schema-runtime-integrity

## 描述

Schema 是 mutable 的。当 Agent 发版做快照时，如果 Schema A 的 json 字段通过 `schemaId` 引用了 Schema B，发布快照是否也冻结了 B 的状态？如果没有，修改 B 会隐式影响已发布版本的行为，导致线上 Agent 的工具参数结构悄悄变化。

同理，Schema includes 的引用也存在相同问题——修改被 include 的 Schema 会影响所有引用方。

## 分析

需要确认 Agent 版本管理系统的快照机制是否覆盖了 Schema 的完整依赖图。关键问题：

1. 发版快照是否深拷贝了 schemas 表的数据？
2. `schemaId` 和 `includeSchemaIds` 中的 UUID 在快照中是指向原始记录还是快照副本？
3. 快照后修改 Schema，已发布版本的行为是否不变？

## 修复方向

确保版本快照时对 Schema 做完整的深拷贝：
1. 快照 schemas 表记录（包括 parameters JSONB）
2. 快照 schema_includes 关联关系
3. 快照中的 `schemaId` / `includeSchemaIds` 指向快照副本而非原始记录
4. 或者采用另一种方案：发布时将所有 Schema 引用"内联展开"为解析后的最终参数列表，不保留引用关系
