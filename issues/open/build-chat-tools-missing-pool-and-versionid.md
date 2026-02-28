---
priority: P1
---
# Build Chat 工具只查私有资源，缺少池引用和 versionId 过滤

## Symptom（看到了什么）
Build Chat 的服务端工具（如 `list_tools`）只查询 `eq(tools.agentId, agentId)`，完全忽略通过 `agentResourceRefs` 引用的池资源。同时所有工具操作都不传 versionId，可能跨版本数据混入。

## Trigger（怎么触发的）
代码审查发现。FDE 在 Build Chat 中问"我的 Agent 有哪些工具"，只能看到私有工具，看不到从池中添加的系统内置工具。

## Locale（大概在哪）
`web/src/lib/build-chat/tools/tool-tools.ts:26`，以及 `build-chat/tools/` 下所有工具定义文件。

## Hypothesis（猜是什么原因）
Build Chat 工具实现早于池引用系统。需要改为调用 `getAgentResources()` 获取完整资源列表（含池引用），并传入 versionId。
