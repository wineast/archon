---
priority: P2
---
# 添加全局 SWRConfig 统一错误处理和重试策略

添加全局 `SWRConfig` provider 配置错误重试策略、`revalidateOnFocus` 控制、全局 `onError`（如 401 自动重定向到登录、403 显示权限不足提示）。当前每个 SWR hook 使用默认配置，无统一错误处理，导致重复的错误处理逻辑散落在各组件中。

> Anchor: `web/src/components/providers.tsx`
