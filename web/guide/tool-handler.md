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

支持两种写法格式：

**ES6 模块格式（推荐）**：

```js
import { wiki, dataset, fn, ontology } from "archon:context";

export default async function(args) {
  const doc = await wiki.get(args.docId);
  return { title: doc?.meta?.title, content: doc?.content };
}
```

工具 Handler 支持以下虚拟模块：

| 命名空间 | 用途 | 示例 |
|----------|------|------|
| `archon:context` | 运行时 API（wiki/dataset/fn/ontology） | `import { wiki, fn } from "archon:context"` |
| `archon:lib/filtrex` | 表达式过滤引擎 | `import { compileExpression } from "archon:lib/filtrex"` |

**旧闭包格式**：

```js
async (args, context) => {
  const doc = await context.wiki.get(args.docId);
  return { title: doc?.meta?.title, content: doc?.content };
}
```

- `args` — 工具定义的 parameters 解析后的对象
- `context` — 运行时数据访问 API（见下方）
- 返回值为任意可序列化的 JSON 对象

系统通过检测 `import`/`export` 关键字自动判断格式。

## Context API

代码模式下，第二个参数 `context` 提供以下 API：

### context.wiki

```js
// 按 key 或 ID 获取文档（content 经过模板渲染）
const doc = await context.wiki.get("product-intro");
// → { meta: { ... } | null, content: "渲染后的正文" }

// 按 key 前缀批量查找（content 为原始正文）
const docs = await context.wiki.findByPrefix("product-");
// → [{ id, title, meta, content }, ...]

// 按内容关键词搜索（content 为原始正文）
const results = await context.wiki.search("关键词");
// → [{ id, title, meta, content }, ...]
```

### context.dataset

```js
// 获取数据集值
const val = await context.dataset.get("company_name");
// → "GMCC" | null

// 获取对象类型数据集（返回原始 JSON）
const routes = await context.dataset.get("product_routes");
// → { universe: { label: "...", states: [...] }, ... } | null
```

### context.fn(key)

调用 Functions 页面定义的函数：

```js
const calc = await context.fn("calculate_price");
const result = await calc({ quantity: 10, unitPrice: 99 });
```

### context.ontology

操作知识图谱（Ontology）：

```js
// 列出所有对象类型
const types = await context.ontology.types();

// 获取类型详情（含属性和关系定义）
const type = await context.ontology.type("customer");

// 查询实例（可选 filters）
const customers = await context.ontology.query("customer", { city: "北京" });

// 获取单个实例（含关联链接）
const c = await context.ontology.get("customer", instanceId);

// 创建实例
const created = await context.ontology.create("customer", { name: "张三" });

// 更新实例（merge data）
await context.ontology.update("customer", id, { phone: "138..." });

// 删除实例
await context.ontology.delete("customer", id);

// 创建关联
await context.ontology.link(sourceId, "has_order", targetId);

// 删除关联
await context.ontology.unlink(sourceId, "has_order", targetId);

// 获取关系图（BFS，默认深度 2，最大 5）
const graph = await context.ontology.graph("customer", id, { depth: 2 });
// → { nodes: [...], edges: [...] }
```

## 沙盒模式

代码模式在服务端执行时，可选择沙盒隔离级别：

| 模式 | 说明 |
|------|------|
| **轻量** | 快速执行，适合简单逻辑（默认） |
| **完整** | 完全隔离的 VM 沙盒，适合执行不可信代码 |

## 示例

### 查询 Wiki 文档并返回摘要

```js
async (args, context) => {
  const results = await context.wiki.search(args.keyword);
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
async (args, context) => {
  const products = await context.dataset.get("products");
  const entries = Object.entries(products || {});
  const matched = entries.filter(([, val]) =>
    val.category === args.category
  );
  return { matched_count: matched.length, products: matched.map(([k, v]) => ({ key: k, ...v })) };
}
```

### 调用 Function 计算

```js
async (args, context) => {
  const calc = await context.fn("loan_calculator");
  return await calc({
    principal: args.amount,
    rate: args.rate,
    months: args.term,
  });
}
```

### 使用 filtrex 过滤数据

```js
import { dataset } from "archon:context";
import { compileExpression } from "archon:lib/filtrex";

export default async function(args) {
  const items = await dataset.get(args.datasetKey);
  const entries = Object.values(items || {});
  const filter = compileExpression(args.filter);
  return entries.filter(entry => filter(entry));
}
```
