# 工具组件渲染预览

工具（Tool）可通过 `componentId` 关联一个组件。在聊天中，AI 调用工具后会用关联组件渲染结果。此功能将组件预览扩展到 Playground 和 Test Cases 中，使开发者在测试工具时即可看到组件渲染效果。

## 行为规则

- 工具关联了组件 + 执行成功 → 在 JSON Output 下方自动显示「Component Preview」区域
- 工具没有关联组件（`componentId` 为空）→ 不渲染预览区域
- 工具执行失败/报错 → 不渲染预览区域
- 组件渲染失败 → `DynamicComponentErrorBoundary` 显示内联错误，不影响 pass/fail 判断

## 展示位置

| 位置 | 说明 |
|------|------|
| Playground | Output JSON 下方，执行成功时展示 |
| Test Case 单条执行 | 结果区域中 JsonEditor 下方 |
| Run All 批量结果 | 每条结果展开后 Actual Output 下方 |
| History 历史记录 | 展开后每条结果的 Actual Output 下方 |

## 数据流

```
tool.componentId
  → useToolComponentPreview(componentId, agentId)
    → useComponents(agentId)          // 获取组件列表
    → 找到对应 component              // 取 componentSource, generatedCss
    → useCompiledComponent(key, ...)  // 编译组件图
  → { compiledComponent, generatedCss }
  → <ToolComponentPreview>
    → useEffect 注入 CSS（@layer components）
    → <DynamicComponentErrorBoundary>
      → <DynamicComponentRenderer tool={...} state="output-available" />
```

## CSS 策略

组件的 `generatedCss` 是 Tailwind CSS 编译产物。这些 CSS **必须注入**，因为数据库存储的组件 JSX 不在 Tailwind 的 `content` 扫描路径中，组件使用的任意值类（如 `bg-[#ff5722]`、`text-[14px]`）不会出现在全局 CSS 中。

### 后端编译（`compile-css.ts`）

`extractUtilityCss` 从 Tailwind 完整编译输出中提取 `@layer utilities { ... }` 的**内部规则**，去掉 `@layer utilities` 包裹，存入数据库的 `generatedCss` 是纯 CSS class 规则。

### 前端注入

注入时用 `@layer components` 包裹：

```ts
style.textContent = `@layer components {\n${generatedCss}\n}`;
```

效果：
- **重复的标准 utility**（`.flex`、`.w-full` 等）：全局 `@layer utilities` 优先级更高，`@layer components` 中的重复版本被忽略，无害
- **组件独有的 class**（任意值、自定义 class）：在 `@layer components` 中正常生效
- **响应式变体**：`@layer utilities` > `@layer components`，全局响应式变体正确覆盖

此策略统一应用于所有 CSS 注入点：Chat、Embed、Share、Tool Preview。

## 关键文件

| 文件 | 说明 |
|------|------|
| `web/src/components/tools/tool-component-preview.tsx` | 共享预览组件，注入 CSS + 渲染 |
| `web/src/lib/tools/use-tool-component-preview.ts` | Hook：从 componentId 编译出可渲染组件 |
| `web/src/components/tools/tool-detail.tsx` | 调用 hook，传递给子 Tab |
| `web/src/components/tools/tool-playground.tsx` | Playground 展示预览 |
| `web/src/components/tools/tool-test-case-item.tsx` | 单条测试用例展示预览 |
| `web/src/components/tools/tool-test-cases-panel.tsx` | 透传预览数据 |
| `web/src/components/tools/tool-run-result-card.tsx` | Run All 结果展示预览 |
| `web/src/components/tools/tool-run-history-item.tsx` | 历史记录透传预览数据 |
