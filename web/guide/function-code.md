# 函数代码编写指南

## 基本结构

**ES module 格式是唯一支持的代码格式。** 使用 `archon:*` 虚拟模块导入依赖，`export default` 导出函数：

```js
import other_fn from "archon:fn/other_fn";

export default function(input) {
  const result = other_fn({ value: input.x * 2 });
  return { ...result, processed: true };
}
```

---

## 运行环境

函数通过 **直接执行 + 静态代码扫描** 运行：

- 代码提交前经过 `acorn` AST 静态扫描，禁止危险模式
- 禁止访问 Node.js 全局变量（`process`、`global`、`Buffer` 等）
- 禁止 `require()`、`eval()`、`new Function()` 调用
- 可使用标准 JavaScript 内置对象（`Math`、`Date`、`JSON`、`RegExp` 等）
- **只支持** `archon:*` 虚拟模块，其他 import 路径会被静态扫描阻止

---

## archon:* 虚拟模块

| 模块 | 说明 |
|------|------|
| `archon:fn/<key>` | 导入同 Agent 下的其他函数，包括内置（builtin）函数 |

### archon:fn/<key>

导入的函数是**同步调用**的（不需要 `await`）。支持导入内置函数（如 `compileExpression`）——系统会自动检测代码中的 `import` 语句，从数据库获取缺失的 builtin 函数并注入运行时：

```js
import other_fn from "archon:fn/other_fn";

export default function(input) {
  // 直接调用，不用 await
  const result = other_fn({ value: input.x * 2 });
  return { ...result, processed: true };
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
import format_currency from "archon:fn/format_currency";

export default function(input) {
  const { items, taxRate } = input;

  const result = items.map(item => ({
    name: item.name,
    price: item.price,
    tax: item.price * taxRate,
  }));

  const total = result.reduce((sum, r) => sum + r.price + r.tax, 0);

  return {
    items: result,
    total: format_currency({ value: total, currency: "CNY" }),
  };
}
```
