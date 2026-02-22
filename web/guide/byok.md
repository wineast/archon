# BYOK（Bring Your Own API Key）

## 概述

组织管理员可在 Settings > API Keys 中配置各 AI Provider 的 API Key。配置后，该组织下所有 Agent 的 AI 调用将优先使用组织的 Key；未配置的 Provider 自动 fallback 到平台额度。

## 支持的 Provider

### 官方 SDK 直连

| Provider | SDK 包 |
|----------|--------|
| Anthropic | `@ai-sdk/anthropic` |
| OpenAI | `@ai-sdk/openai` |
| Google | `@ai-sdk/google` |
| xAI | `@ai-sdk/xai` |
| DeepSeek | `@ai-sdk/deepseek` |
| Mistral | `@ai-sdk/mistral` |
| Cohere | `@ai-sdk/cohere` |
| Perplexity | `@ai-sdk/perplexity` |

### OpenAI 兼容协议接入

以下 Provider 通过 `@ai-sdk/openai` 的 `createOpenAI({ baseURL, apiKey })` 方式接入：

| Provider | 显示名 | baseURL |
|----------|--------|---------|
| alibaba | 阿里云百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| moonshot | Moonshot (Kimi) | `https://api.moonshot.cn/v1` |
| zhipu | 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` |
| minimax | MiniMax | `https://api.minimax.chat/v1` |
| bytedance | 火山引擎 | `https://ark.cn-beijing.volces.com/api/v3` |

### 不支持 BYOK 的 Provider

| Provider | 原因 |
|----------|------|
| Meta (Llama) | 无直接 API，模型托管在第三方推理平台 |
| Amazon (Nova) | 需要 AWS Access Key + Secret，非标准 API Key |

这些 Provider 的模型始终走平台网关。

## 架构

### 数据存储

- **表**: `org_api_keys`（`web/src/db/schema.ts`）
- **加密**: AES-256-GCM，密钥来自环境变量 `API_KEY_ENCRYPTION_SECRET`
- **加密工具**: `web/src/lib/crypto.ts`

### 模型解析流程

核心文件：`web/src/lib/ai/resolve-model.ts`

```
resolveModel(modelId, orgId)
├─ 无 orgId → gateway(modelId)
├─ 解析 provider（"anthropic/claude-sonnet-4" → provider="anthropic"）
├─ provider 不在支持列表 → gateway(modelId)
├─ 查询 org 是否有该 provider 的 active key
│  ├─ 无 key → gateway(modelId)
│  └─ 有 key → 创建直连 provider 实例
```

### 缓存

- `web/src/lib/ai/org-api-keys.ts`：60 秒 TTL 内存缓存
- null 也缓存（避免无 key 时反复查库）
- CRUD 后调用 `invalidateOrgApiKeyCache()` 清除缓存

## Model ID 格式

统一使用 `provider/model-name` 格式（斜杠分隔）：

- `anthropic/claude-sonnet-4-20250514`
- `openai/gpt-4o-mini`
- `google/gemini-2.0-flash`

旧的冒号格式（`openai:gpt-4o-mini`）仍兼容。

## API 路由

### `GET /api/orgs/[id]/api-keys`
列出 org 的 API keys（key 脱敏为 `****后4位`），需 admin 权限。

### `POST /api/orgs/[id]/api-keys`
创建或更新 API key（基于 orgId + provider upsert），需 admin 权限。

Body: `{ provider: string, apiKey: string }`

### `DELETE /api/orgs/[id]/api-keys/[keyId]`
删除 API key，需 admin 权限。

## UI

Org Settings 页面新增 "API Keys" tab（`web/src/app/[orgSlug]/settings/page.tsx`）。

面板组件：`web/src/components/orgs/org-api-keys-panel.tsx`

Hooks：`web/src/lib/orgs/api-keys-hooks.ts`

## 环境变量

| 变量 | 说明 |
|------|------|
| `API_KEY_ENCRYPTION_SECRET` | 用于 AES-256-GCM 加密 API Key 的密钥（任意长度字符串，会 SHA-256 hash 为 32 字节） |

## 影响的调用点

所有 AI 调用点均已接入 `resolveModel()`：

- Agent Chat（`web/src/lib/chat/execute-stream.ts`）
- Build Chat（`web/src/lib/build-chat/execute-stream.ts`）
- Prompt Assist（`web/src/app/api/prompt-assist/route.ts`）
- Function Code Assist（`web/src/app/api/function-code-assist/route.ts`）
- Schema Code Assist（`web/src/app/api/schema-code-assist/route.ts`）
- JSX Assist（`web/src/app/api/jsx-assist/route.ts`）
- Memory Extract（`web/src/lib/memory/extract.ts`）
- Eval（`web/src/app/api/eval/run/[runId]/case/route.ts`）
