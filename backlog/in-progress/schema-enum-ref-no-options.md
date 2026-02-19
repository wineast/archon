# Schema 表单枚举引用选择为空

- **类型**: bug
- **优先级**: high
- **发现日期**: 2026-02-19
- **工作区**: schema-runtime-fixes

## 描述

在 Schema 编辑表单中，Enum 类型参数选择"引用"模式后，"选择引用..."下拉框没有任何选项可选，尽管系统中有大量 datasets。见对话中截图。

## 分析

- `web/src/components/schemas/schema-form.tsx:135`：`<ParameterList>` 调用时未传递 `enumRefOptions` 和 `enumRefValues` props
- `web/src/components/parameters/parameter-list.tsx:14-15`：这两个 props 是可选的，未传时默认为 undefined
- `web/src/components/parameters/parameter-row.tsx:470`：`enumRefOptions.length > 0` 判断为 false，下拉框无选项
- 需要在 `schema-form.tsx` 中用 `useEnumRefOptions` hook（`web/src/lib/datasets/hooks.ts`）获取 datasets 并传给 ParameterList

## 修复方向

- 在 `schema-form.tsx` 中调用 `useEnumRefOptions` hook 获取 `enumRefOptions` 和 `enumRefValues`
- 将两者传递给 `<ParameterList enumRefOptions={...} enumRefValues={...} />`
