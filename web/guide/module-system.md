# 模块系统（archon:* 虚拟模块）

函数、工具 Handler、组件三个代码系统均支持通过 ES6 `import` 语法引入依赖，使用 `archon:*` 虚拟模块协议。

---

## 模块命名空间

| 命名空间 | 用途 | 适用场景 |
|---------|------|---------|
| `archon:fn/<key>` | 导入同 Agent 下的其他函数 | 函数 |
| `archon:context` | 导入平台 API（wiki/dataset/fn/ontology） | 工具 Handler |
| `archon:react` | React core hooks | 组件 |
| `archon:ui` | UI 组件（Badge, Table 等） | 组件 |
| `archon:icons` | Lucide 图标 | 组件 |
| `archon:component/<key>` | 导入同 Agent 下的其他组件 | 组件 |

---

## 函数

```js
import other_fn from "archon:fn/other_fn";

export default function(input) {
  return other_fn({ value: input.x * 2 });
}
```

- `export default` 必须导出一个函数，接收 `input` 参数
- 函数之间的依赖关系从 `archon:fn/<key>` 导入语句自动推断

---

## 工具 Handler

```js
import { wiki, fn } from "archon:context";

export default async function(args) {
  const doc = await wiki.get(args.docId);
  const calc = await fn("pricing_engine");
  return calc({ config: doc.meta });
}
```

工具 Handler 支持一个虚拟模块：

| 模块 | 用途 |
|------|------|
| `archon:context` | 运行时 API（wiki / dataset / fn / ontology） |

`archon:context` 可导出的成员：

| 成员 | 类型 | 说明 |
|------|------|------|
| `wiki` | object | Wiki 文档查询（get / findByPrefix / search） |
| `dataset` | object | 数据集查询（get） |
| `fn` | function | 获取已编译函数：`await fn("key")` |
| `ontology` | object | 本体 CRUD（types / query / get / create / update / delete / link / unlink / graph） |

---

## 组件

```jsx
import { useState } from "archon:react";
import { Badge } from "archon:ui";
import ProductCard from "archon:component/product-card";

export default function({ tool, isLoading }) {
  const [open, setOpen] = useState(false);
  return <Badge>{tool.output.status}</Badge>;
}
```

### archon:react 可用导出

`React`、`useState`、`useMemo`、`useCallback`、`useEffect`、`useRef`、`Fragment`

### archon:ui 可用导出

`Badge`、`Spinner`、`Table`、`TableBody`、`TableCell`、`TableHead`、`TableHeader`、`TableRow`、`Tooltip`、`TooltipContent`、`TooltipTrigger`、`CollapsibleSection`、`Sheet`、`SheetContent`、`SheetHeader`、`SheetTitle`、`Popover`、`PopoverContent`、`PopoverTrigger`

### archon:icons 可用导出

`ChevronRight`、`ChevronDownIcon`、`FileText`、`WrenchIcon`、`CheckCircleIcon`、`ClockIcon`、`XCircleIcon`、`CircleIcon`

---

## Monaco 编辑器支持

编辑器已注册 `archon:*` 模块的类型声明，输入 `import` 语句时会获得自动补全和类型提示。

动态类型（`archon:fn/<key>` 和 `archon:component/<key>`）需要通过 `JsEditor` 的 `moduleDeclarations` prop 传入，由表单组件根据当前 Agent 的函数/组件列表动态生成。

生成动态类型的工具函数：

```ts
import {
  generateFnDeclarations,
  generateComponentDeclarations,
} from "@/lib/modules/archon-types";

const declarations = [
  generateFnDeclarations(["calc", "format"]),
  generateComponentDeclarations(["product-card", "price-badge"]),
].join("\n");
```
