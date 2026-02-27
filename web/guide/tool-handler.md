# 工具 Handler 编写指南

## 两种 Handler 模式

### URL 模式

填写远程 API 地址。调用时 Archon 会 POST 工具参数（JSON）到该 URL，期望返回 JSON 响应。

```
https://api.example.com/search
```

调用时等效于：

```js
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(args),
});
return await res.json();
```

适用场景：企业已有 API、第三方服务对接、微服务调用。

### 代码模式

**ES module 格式是唯一支持的代码格式。** 使用 `import` 导入虚拟模块，`export default` 导出处理函数：

```js
import { wiki, dataset, fn, ontology } from "archon:context";

export default async function(args) {
  const doc = await wiki.get(args.docId);
  return { title: doc?.meta?.title, content: doc?.content };
}
```

- `args` — 工具定义的 parameters 解析后的对象
- 通过 `import` 从虚拟模块导入运行时 API（见下方）
- 返回值为任意可序列化的 JSON 对象

**只支持** `archon:*` 虚拟模块，其他 import 路径（如 `fs`、`path`、npm 包名）会报错。

| 命名空间 | 用途 | 示例 |
|----------|------|------|
| `archon:context` | 运行时 API（wiki/dataset/fn/ontology） | `import { wiki, fn } from "archon:context"` |
| `archon:lib/<key>` | 宿主依赖（如 `compileExpression`） | `import compileExpression from "archon:lib/compileExpression"` |

### 运行环境

代码通过 **直接执行 + 静态代码扫描** 运行：

- 代码执行前经过 `acorn` AST 静态扫描，禁止危险模式
- 禁止访问 Node.js 全局变量（`process`、`global`、`Buffer` 等）
- 禁止 `require()`、`eval()`、`new Function()` 调用
- 可使用标准 JavaScript 内置对象（`Math`、`Date`、`JSON`、`RegExp`、`Promise` 等）
- 支持 `async/await`

## Context API

通过 `import { wiki, dataset, fn, ontology } from "archon:context"` 导入运行时 API。

### wiki

```js
import { wiki } from "archon:context";

// 按 key 或 ID 获取文档（content 经过完整模板渲染，含 {% include %} 展开）
const doc = await wiki.get("product-intro");
// → { meta: { ... } | null, content: "渲染后的正文" }

// 按 key 前缀批量查找（content 为原始正文，未渲染）
const docs = await wiki.findByPrefix("product-");
// → [{ id, title, meta, content }, ...]

// 按内容关键词搜索（content 为原始正文，未渲染）
const results = await wiki.search("关键词");
// → [{ id, title, meta, content }, ...]
```

### dataset

```js
import { dataset } from "archon:context";

// 获取数据集值
const val = await dataset.get("company_name");
// → "GMCC" | null

// 获取对象类型数据集（返回原始 JSON）
const routes = await dataset.get("product_routes");
// → { universe: { label: "...", states: [...] }, ... } | null
```

### fn(key)

调用 Functions 页面定义的函数：

```js
import { fn } from "archon:context";

const calc = await fn("calculate_price");
const result = await calc({ quantity: 10, unitPrice: 99 });
```

### ontology

操作知识图谱（Ontology）：

```js
import { ontology } from "archon:context";

// 列出所有对象类型
const types = await ontology.types();

// 获取类型详情（含属性和关系定义）
const type = await ontology.type("customer");

// 查询实例（可选 filters）
const customers = await ontology.query("customer", { city: "北京" });

// 获取单个实例（含关联链接）
const c = await ontology.get("customer", instanceId);

// 创建实例
const created = await ontology.create("customer", { name: "张三" });

// 更新实例（merge data）
await ontology.update("customer", id, { phone: "138..." });

// 删除实例
await ontology.delete("customer", id);

// 创建关联
await ontology.link(sourceId, "has_order", targetId);

// 删除关联
await ontology.unlink(sourceId, "has_order", targetId);

// 获取关系图（BFS，默认深度 2，最大 5）
const graph = await ontology.graph("customer", id, { depth: 2 });
// → { nodes: [...], edges: [...] }
```

> **重要**：`wiki.get()` 返回的 `content` 经过完整模板渲染（含 `{% include %}` 展开），而 `wiki.findByPrefix()` 和 `wiki.search()` 返回的 `content` 是原始正文（仅去除 frontmatter），不经过渲染。

## 示例

### 查询 Wiki 文档并返回摘要

```js
import { wiki } from "archon:context";

export default async function(args) {
  const results = await wiki.search(args.keyword);
  return {
    count: results.length,
    summaries: results.slice(0, 5).map(d => ({
      title: d.title,
      preview: d.content.slice(0, 100),
    })),
  };
}
```

### 根据数据集路由匹配

```js
import { dataset } from "archon:context";

export default async function(args) {
  const products = await dataset.get("products");
  const entries = Object.entries(products || {});
  const matched = entries.filter(([, val]) =>
    val.category === args.category
  );
  return { matched_count: matched.length, products: matched.map(([k, v]) => ({ key: k, ...v })) };
}
```

### 调用 Function 计算

```js
import { fn } from "archon:context";

export default async function(args) {
  const calc = await fn("loan_calculator");
  return await calc({
    principal: args.amount,
    rate: args.rate,
    months: args.term,
  });
}
```

### 使用 archon:lib 直接访问宿主依赖

```js
import compileExpression from "archon:lib/compileExpression";

export default function(args) {
  const expr = compileExpression(args.formula);
  return { result: expr(args.data) };
}
```

### 混合使用 archon:context + archon:lib

```js
import { dataset } from "archon:context";
import compileExpression from "archon:lib/compileExpression";

export default async function(args) {
  const items = await dataset.get(args.datasetKey);
  const entries = Object.values(items || {});
  const filter = compileExpression(args.filter);
  return entries.filter(entry => filter(entry));
}
```
