# Edit / Preview 切换模式

## 设计原则

所有「编辑内容 vs 预览渲染结果」的切换，统一使用 **Radix `<Tabs>`** 组件实现。禁止用 Button 自行实现模式切换。

理由：

- Tabs 语义化更强，自带 ARIA 无障碍支持
- 一致的视觉风格，减少维护负担
- Radix Tabs 支持受控/非受控两种模式，能覆盖所有场景

---

## 所有入口清单

| 位置 | 文件路径 | 预览内容类型 | 是否调用 API |
|------|---------|-------------|-------------|
| Wiki 编辑器 | `editors/wiki-editor.tsx` | Markdown + Liquid 模板 | 否（客户端渲染） |
| 数据集表单 | `datasets/dataset-form.tsx` | JSON + Liquid 模板 | 是（`/api/template/preview`） |
| 模型配置 | `model-config/model-config-detail.tsx` | Markdown + Liquid 模板 | 是（`/api/template/preview`） |
| Schema 详情 | `schemas/schema-detail.tsx` | Zod Code + JSON Schema | 否（客户端生成） |
| 请求检查器 - System | `request-inspector-modal.tsx` | 系统提示词 模板/渲染 | 是（`/api/template/preview`） |
| 请求检查器 - Messages | `request-inspector-modal.tsx` | 消息格式（UI/Model） | 否（纯格式切换） |

---

## 标准实现模板

```tsx
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function MyEditor() {
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "edit" | "preview")}
      className="flex flex-col flex-1 min-h-0"
    >
      <TabsList>
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>

      <TabsContent value="edit" className="flex-1 min-h-0 overflow-hidden">
        {/* 编辑器内容 */}
      </TabsContent>

      <TabsContent value="preview" className="flex-1 min-h-0 overflow-auto">
        {/* 预览内容 */}
      </TabsContent>
    </Tabs>
  );
}
```

---

## 注意事项

### flex 布局处理

当 Tabs 需要填充剩余空间时：

- `<Tabs>` 加 `className="flex flex-col flex-1 min-h-0"`
- `<TabsContent>` 加 `className="flex-1 min-h-0"`，按需追加 `overflow-hidden`（编辑器）或 `overflow-auto`（预览）

### Lazy Preview 加载

如果预览需要调用 API（如 `/api/template/preview`），建议在切换到 preview tab 时才触发请求，避免无谓的网络开销。参考 `model-config-detail.tsx` 的 `handleTabChange` 模式：

```tsx
const handleTabChange = (value: string) => {
  setActiveTab(value as "edit" | "preview");
  if (value === "preview") {
    fetchPreview();
  }
};
```

### 嵌套 Tabs

在已有外层 Tabs 的组件中（如 `request-inspector-modal.tsx`），可以直接使用独立的 `<Tabs>` 组件嵌套，Radix Tabs 各实例互不干扰：

```tsx
{/* 外层 Tabs */}
<Tabs defaultValue="overview">
  <TabsList>...</TabsList>
  <TabsContent value="system">
    {/* 内层 Tabs —— 独立实例，不冲突 */}
    <Tabs value={systemView} onValueChange={setSystemView}>
      <TabsList>
        <TabsTrigger value="rendered">Rendered</TabsTrigger>
        <TabsTrigger value="template">Template</TabsTrigger>
      </TabsList>
      <TabsContent value="rendered">...</TabsContent>
      <TabsContent value="template">...</TabsContent>
    </Tabs>
  </TabsContent>
</Tabs>
```
