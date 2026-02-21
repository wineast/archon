# 函数代码编写指南

## 基本结构

使用 `archon:*` 虚拟模块导入依赖，`export default` 导出函数：

```js
import other_fn from "archon:fn/other_fn";

export default function(input) {
  const result = other_fn({ value: input.x * 2 });
  return { ...result, processed: true };
}
```

---

## archon:* 虚拟模块

| 模块 | 说明 |
|------|------|
| `archon:fn/<key>` | 导入同 Agent 下的其他函数 |
| `archon:lib/filtrex` | 导入 filtrex 表达式编译器（`compileExpression`） |

示例——使用 filtrex：

```js
import { compileExpression } from "archon:lib/filtrex";

export default function(input) {
  const evaluate = compileExpression("price * quantity");
  return { total: evaluate(input) };
}
```

---

## 函数签名

- **input**：符合 Parameters Schema 定义的 JSON 对象
- **返回值**：符合 Return Parameters Schema 定义的 JSON 对象
- 支持 `async/await`

```js
export default async function(input) {
  const { userId, action } = input;
  return { success: true, userId };
}
```

---

## 完整示例

```js
import { compileExpression } from "archon:lib/filtrex";
import format_currency from "archon:fn/format_currency";

export default function(input) {
  const { items, taxRate } = input;
  const calcTax = compileExpression("price * rate");

  const result = items.map(item => ({
    name: item.name,
    price: item.price,
    tax: calcTax({ price: item.price, rate: taxRate }),
  }));

  const total = result.reduce((sum, r) => sum + r.price + r.tax, 0);

  return {
    items: result,
    total: format_currency({ value: total, currency: "CNY" }),
  };
}
```
