# 工具 Examples 功能

## 概述

工具（Tools）支持将 Test Case 标记为 Example，在 Examples Tab 中只读展示，并在 Playground 的 Load 下拉中分组显示。与组件（Components）的 Examples 功能对齐。

## 数据模型

### toolTestCases 表新增字段

```
showAsExample BOOLEAN NOT NULL DEFAULT false
```

- `true`：该 Test Case 同时作为 Example 展示
- `false`：仅作为普通 Test Case

## 功能入口

### 1. Test Cases Tab — Show as Example 开关

在每个 Test Case 的展开区域（Tags 和 Input 之间），有一个 `Switch` 开关：

- 切换时立即保存到服务端（乐观更新）
- 打开后该 Test Case 会出现在 Examples Tab
- 保存 Test Case 时也会一并保存 `showAsExample` 状态

### 2. Examples Tab（只读）

位于 Edit 和 Playground 之间的 Tab，展示所有 `showAsExample = true` 的 Test Case：

- 每个 Example 以卡片形式展示：名称 + Tags + Input（只读 JsonEditor）+ Expected Output（只读 JsonEditor，仅非空时显示）
- 空状态引导用户去 Test Cases tab 开启 Show as Example
- 只读，不支持编辑或删除（需到 Test Cases tab 操作）

### 3. Playground — Save as Test Case

底部操作栏新增 **Save** 按钮，点击弹出 Dialog：

- **Name**：测试用例名称（auto-focus，Enter 提交）
- **Tags**：标签输入（Enter/blur 添加）
- **Show as Example**：开关，决定是否同时标记为 Example
- 保存后自动刷新 Test Cases 列表

### 4. Playground — Load 下拉分组

Load 下拉菜单按 Examples / Test Cases 分组显示：

- **Examples** 组：`showAsExample = true` 的 Test Case
- **Test Cases** 组：`showAsExample = false` 的 Test Case
- 两组之间有分隔线
- 点击任一项加载其 `input` 到编辑器

## API

### POST `/api/tools/[id]/test-cases`

新增可选字段：

```json
{
  "showAsExample": true
}
```

### PUT `/api/tools/[id]/test-cases/[caseId]`

支持更新：

```json
{
  "showAsExample": true
}
```

## 相关文件

| 文件 | 说明 |
|------|------|
| `web/src/db/schema.ts` | `toolTestCases.showAsExample` 字段 |
| `web/src/app/api/tools/[id]/test-cases/route.ts` | POST 支持 showAsExample |
| `web/src/app/api/tools/[id]/test-cases/[caseId]/route.ts` | PUT 支持 showAsExample |
| `web/src/lib/tools/test-case-hooks.ts` | `createToolTestCase` 参数扩展 |
| `web/src/components/tools/tool-test-case-item.tsx` | Switch 开关 UI |
| `web/src/components/tools/tool-test-cases-panel.tsx` | onSave 类型适配 |
| `web/src/components/tools/tool-playground.tsx` | Save Dialog + Load 分组 |
| `web/src/components/tools/tool-examples-panel.tsx` | Examples 只读面板 |
| `web/src/components/tools/tool-detail.tsx` | Examples Tab 入口 |
