# 组件编写指南

## 两层闭包结构

每个组件采用两层闭包结构：外层接收依赖注入，内层接收运行时 props。

```jsx
function Component({ React, useState, Badge }) {
  // 外层：声明依赖（只在组件加载时执行一次）

  return function ({ tool, state, isLoading, isComplete, isError }) {
    // 内层：渲染逻辑（每次 props 变化时执行）
    const [expanded, setExpanded] = useState(false);

    return (
      <div className="p-4">
        <Badge variant="secondary">{tool.name}</Badge>
        <pre>{JSON.stringify(tool.output, null, 2)}</pre>
      </div>
    );
  };
}
```

## 外层可用依赖

外层参数通过解构获取所需依赖，只取需要的即可。

### React 核心

| 名称 | 说明 |
|------|------|
| `React` | React 命名空间 |
| `useState` | 状态 Hook |
| `useMemo` | 缓存计算结果 |
| `useCallback` | 缓存回调函数 |
| `useEffect` | 副作用 Hook |
| `useRef` | Ref Hook |
| `Fragment` | React Fragment (`<>...</>`) |

### UI 组件

| 名称 | 说明 |
|------|------|
| `Badge` | 标签徽章 |
| `Spinner` | 加载动画 |
| `Table` | 表格容器 |
| `TableBody` | 表格 body |
| `TableCell` | 表格单元格 |
| `TableHead` | 表头单元格 |
| `TableHeader` | 表头行容器 |
| `TableRow` | 表格行 |
| `Tooltip` | 提示气泡容器 |
| `TooltipContent` | 提示内容 |
| `TooltipTrigger` | 提示触发器 |
| `CollapsibleSection` | 可折叠区块 |
| `ResultHeader` | 结果头部 |
| `ResultSection` | 结果区块 |
| `RateSheetLinks` | 费率链接 |
| `RateSheetPanel` | 费率面板 |
| `SourceDocumentViewer` | 文档查看器 |

### 图标

| 名称 | 说明 |
|------|------|
| `ChevronRight` | 右箭头图标 |
| `FileText` | 文件图标 |

### 自定义组件

同一 Agent 下的其他组件可以通过 PascalCase 名称引用。例如组件 key 为 `product-card`，则在外层解构 `ProductCard`：

```jsx
function Component({ React, ProductCard }) {
  return function ({ tool }) {
    return <ProductCard tool={tool} />;
  };
}
```

## 内层 Props

| 属性 | 类型 | 说明 |
|------|------|------|
| `tool` | `object` | 工具调用数据 |
| `state` | `"partial-call" \| "call" \| "result" \| "error"` | 调用状态 |
| `isLoading` | `boolean` | 是否正在加载（`state` 为 `partial-call` 或 `call`） |
| `isComplete` | `boolean` | 是否已完成（`state` 为 `result`） |
| `isError` | `boolean` | 是否出错（`state` 为 `error`） |

### tool 对象字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `tool.name` | `string` | 工具名称 |
| `tool.input` | `object` | 工具输入参数 |
| `tool.output` | `any` | 工具返回结果（仅在 `isComplete` 时有值） |

## JSX 片段简写

如果不需要外层依赖，可以直接写 JSX 片段作为简写模式：

```jsx
<div className="p-4">
  <p>Hello</p>
</div>
```

系统会自动将其包装为完整的两层闭包。

## 样式

组件内可以直接使用 Tailwind CSS 类名进行样式设置。支持所有 Tailwind 工具类。

```jsx
<div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
  <span className="text-sm font-medium">标题</span>
</div>
```

## 完整示例

```jsx
function Component({ React, useState, Badge, Spinner, CollapsibleSection }) {
  return function ({ tool, state, isLoading, isComplete, isError }) {
    const [showRaw, setShowRaw] = useState(false);

    if (isLoading) {
      return (
        <div className="flex items-center gap-2 p-4">
          <Spinner className="size-4" />
          <span className="text-sm text-muted-foreground">正在查询...</span>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="p-4 text-sm text-destructive">
          查询失败，请重试
        </div>
      );
    }

    const data = tool.output;

    return (
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{tool.name}</Badge>
          <span className="text-sm font-medium">{data?.title ?? "结果"}</span>
        </div>

        <CollapsibleSection title="原始数据" defaultOpen={false}>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CollapsibleSection>
      </div>
    );
  };
}
```
