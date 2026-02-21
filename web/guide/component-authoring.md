# 组件编写指南

## 基本结构

使用 `archon:*` 虚拟模块导入依赖，`export default` 导出组件函数：

```jsx
import { useState } from "archon:react";
import { Badge, Spinner } from "archon:ui";

export default function({ data, isLoading, isError }) {
  if (isLoading) return <Spinner className="size-4" />;
  if (isError) return <p className="text-destructive">出错了</p>;

  return (
    <div className="p-4 space-y-2">
      <Badge>{data.output.status}</Badge>
      <p>{data.output.message}</p>
    </div>
  );
}
```

---

## Props

| Prop | 类型 | 说明 |
|------|------|------|
| `data` | `unknown` | 传入的数据 |
| `state` | `string` | `input-streaming` / `input-available` / `output-available` / `error` |
| `isLoading` | `boolean` | 等待工具返回中 |
| `isComplete` | `boolean` | 工具调用已完成 |
| `isError` | `boolean` | 工具调用出错 |

### 对话中的数据映射

组件关联工具后，系统自动将工具调用数据映射为：

```
data = { name, input, output }
```

通过 `data.name`、`data.input`、`data.output` 访问。

---

## 可用依赖

| 模块 | 可用导出 |
|------|---------|
| `archon:react` | `React`、`useState`、`useMemo`、`useCallback`、`useEffect`、`useRef`、`Fragment` |
| `archon:ui` | `Badge`、`Spinner`、`Table`、`TableBody`、`TableCell`、`TableHead`、`TableHeader`、`TableRow`、`Tooltip`、`TooltipContent`、`TooltipTrigger`、`CollapsibleSection`、`ResultHeader`、`ResultSection` |
| `archon:icons` | `ChevronRight`、`FileText` |
| `archon:component/<key>` | 引用同 Agent 下的其他组件 |

---

## 引用其他组件

```jsx
import ProductCard from "archon:component/product-card";

export default function({ data }) {
  return <ProductCard data={data} />;
}
```

---

## 样式

支持所有 Tailwind CSS 类名，包括主题变量（`bg-primary`、`text-muted-foreground` 等）。保存时自动编译 CSS。

---

## 完整示例

```jsx
import { useState } from "archon:react";
import { Badge, Spinner, CollapsibleSection } from "archon:ui";

export default function({ data, isLoading, isError }) {
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
    return <div className="p-4 text-sm text-destructive">查询失败，请重试</div>;
  }

  const { name, output } = data;

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{name}</Badge>
        <span className="text-sm font-medium">{output?.title ?? "结果"}</span>
      </div>

      <CollapsibleSection title="原始数据" defaultOpen={false}>
        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60">
          {JSON.stringify(output, null, 2)}
        </pre>
      </CollapsibleSection>
    </div>
  );
}
```
