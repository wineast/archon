# 内置 Agent（Builtin Agents）

## 概述

内置 Agent 是由系统自动创建的 Agent，按 `scope` 三级体系管理：

| scope | 含义 | 可见性 | 示例 |
|-------|------|--------|------|
| `platform` | 全局平台 Agent | 仅超管可见 | archon-support |
| `org` | 组织自动创建 Agent | org 的 agent 列表 | build-chat, assist |
| `user` | 用户自建 Agent | org 的 agent 列表 | 客服 Agent |

## 自动创建

每个组织创建时，`ensureBuiltinAgents(orgId)` 幂等创建两个 `scope: "org"` 的 Agent：

- **build-chat**：Agent 构建助手，默认模型 `anthropic/claude-sonnet-4`，温度 0.3
- **assist**：AI 辅助编辑，默认模型 `anthropic/claude-sonnet-4`，温度 0.7

每个 Agent 自动创建一个 `isActive=true` 的 `modelConfig`。build-chat 还会 seed 系统工具。

## 模型配置

模型配置存储在 `modelConfigs` 表中（与普通 Agent 相同），通过 `getBuiltinAgentConfig(orgId, slug)` 查询：

- 查找 org 下指定 slug 的 Agent
- 取其 `isActive=true` 的 modelConfig
- 无配置时回退到内置默认值
- 结果缓存 60s

用户可在 agent 详情页的 Model Configs 标签中编辑模型和温度。

## 系统工具

build-chat Agent 的工具以 `isSystem=true` 标记存储在 `tools` 表中：

- 运行时：查询 DB 获取 enabled 状态 → 调用 `buildAllTools()` 获取代码实现 → 交叉过滤
- 用户可 enable/disable 系统工具，但不可编辑 handler/key/description 或删除
- 系统工具的实际逻辑在 `web/src/lib/build-chat/tools/` 的代码中

## 保护规则

- **保留 slug**：`build-chat`、`assist` 不允许用户创建同名 Agent
- **禁止删除**：`scope: "org"` 的 Agent 不允许删除
- **系统工具**：`isSystem=true` 的工具只能切换 enabled，不可编辑或删除

## 关键文件

| 文件 | 作用 |
|------|------|
| `web/src/lib/builtin-agents/constants.ts` | 保留 slug 列表和默认配置 |
| `web/src/lib/builtin-agents/ensure.ts` | 幂等创建内置 Agent + 系统工具 |
| `web/src/lib/builtin-agents/get-config.ts` | 查询内置 Agent 的活跃模型配置 |
| `web/src/lib/build-chat/tools/` | 系统工具代码实现 |

## 消费端

- **Build Chat**（`execute-stream.ts`）：使用 `getBuiltinAgentConfig(orgId, "build-chat")` 获取模型和温度
- **AI 辅助编辑**（`assist-utils.ts`）：使用 `getBuiltinAgentConfig(orgId, "assist")` 获取模型
