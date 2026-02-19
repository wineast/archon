# Build 助手设置没有默认模型

- **优先级**: medium
- **发现日期**: 2026-02-19
- **工作区**: fix-build-model-default

## 描述

管理后台 > Build 助手设置中，模型选择器显示 "Select model..." 而不是默认模型。

## 截图

见对话中附带的截图——模型下拉显示 "Select model..."，Temperature 正常显示 0.3。

## 分析

- `platformSettings` schema 定义了 `buildChatModel` 默认值为 `"anthropic:claude-sonnet-4-20250514"`
- `seed-platform-settings.ts` 只插入 `{ id: "singleton" }`，依赖 DB 列默认值
- UI 代码逻辑（`admin/page.tsx`）在 `isLoading` 时显示 spinner，加载后通过 `useEffect` 设置 model 状态
- **可能原因**：`ModelCombobox` 的模型列表中没有与 `"anthropic:claude-sonnet-4-20250514"` 匹配的项，导致 `models.find()` 返回 `undefined`，触发 placeholder 显示

## 涉及文件

- `web/src/app/admin/page.tsx` — BuildChatSettings 组件
- `web/src/components/model-config/model-combobox.tsx` — ModelCombobox 组件
- `web/src/db/seeders/seed-platform-settings.ts` — seed 逻辑
- `web/src/db/schema.ts:1136-1147` — platformSettings schema

## 修复方向

1. 确认 ModelCombobox 使用的模型列表来源，确保包含 `"anthropic:claude-sonnet-4-20250514"`
2. 或在 seed 中显式设置 `buildChatModel` 值为模型列表中存在的 modelId
