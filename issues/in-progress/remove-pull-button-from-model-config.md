# Model Config 面板的 Pull 按钮需要删除

- **优先级**: low
- **发现日期**: 2026-02-19
- **工作区**: cleanup-dead-code

## 描述

Build 页面 > Model Config tab 底部操作栏有一个 "Pull" 按钮（开发环境可见），该功能需要删除。

## 分析

- `web/src/components/model-config/model-config-detail.tsx:318-331` — Pull 按钮 UI，通过 `isDev && onPull` 条件渲染
- `web/src/components/model-config/model-config-detail.tsx:151-165` — `handlePull` 回调
- `web/src/components/model-config/model-config-detail.tsx:39,50,60` — `onPull` prop 和 `pulling` 状态
- `web/src/components/model-config/model-config-panel.tsx:96-100` — `handlePull` 定义（刷新列表数据）
- `web/src/components/model-config/model-config-panel.tsx:123,159` — 传递 `onPull` prop

## 修复方向

1. 删除 `ModelConfigDetail` 中的 Pull 按钮 JSX、`handlePull` 回调、`pulling` 状态、`onPull` prop
2. 删除 `ModelConfigPanel` 中的 `handlePull` 和传递的 `onPull` prop
3. 清理 `DownloadIcon` import（如果不再使用）
