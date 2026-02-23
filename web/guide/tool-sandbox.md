# 工具沙盒执行

## 概述

工具 Handler 代码通过 **直接执行 + 静态代码扫描** 运行：

1. `acorn` AST 静态扫描，检测危险模式（禁止 `process`/`require`/`eval` 等）
2. ES module 格式转换为 IIFE
3. `new Function()` + `AsyncFunction` 直接执行

当前阶段用户为受信任的 FDA，不需要进程级隔离。安全需求通过静态扫描覆盖。

## 静态代码扫描

扫描器 `lib/code-scanner.ts` 使用 `acorn` + `acorn-walk` 解析 AST，检测以下危险模式：

| 类型 | 检测内容 |
|------|---------|
| 禁止的全局标识符 | `process`, `global`, `globalThis`, `__dirname`, `__filename`, `Buffer` |
| 禁止的调用 | `require(...)`, `eval(...)`, `new Function(...)`, `setTimeout/setInterval` 带字符串参数 |
| 禁止的导入 | `import ... from "非archon:*"` |
| 原型链逃逸 | `constructor.constructor` |

扫描失败时抛出可读错误信息，阻止代码执行。

## 执行流程

### 工具 Handler

```
handler 代码 (ES module)
  → scanCode() 静态扫描
  → transformToolHandlerImports() 转换为 IIFE
  → new AsyncFunction() 直接执行
  → 注入 __args 和 __context
```

入口：`lib/tools/execute-handler.ts`

### 函数

```
函数代码 (ES module)
  → scanCode() 静态扫描
  → transformFunctionModule() 提取依赖和函数体
  → new Function() 编译为闭包
  → 注入 deps（host 依赖 + 已编译函数）
```

入口：`lib/functions/sandbox.ts`

## Handler 代码格式

必须使用 ES module 格式：

```javascript
import { wiki, dataset, fn, ontology } from "archon:context";

export default async function(args) {
  const doc = await wiki.get(args.id);
  return { result: doc };
}
```

### 可用 Context API

- `wiki.get(key)` / `wiki.findByPrefix(prefix)` / `wiki.search(query)`
- `dataset.get(key)` — 获取数据集
- `fn(key)` — 调用 Functions 中定义的函数
- `ontology.query(typeKey)` / `ontology.get(typeKey, id)` / `ontology.create(...)` / `ontology.update(...)` / `ontology.delete(...)` / `ontology.link(...)` / `ontology.unlink(...)` / `ontology.graph(...)`

## 数据模型

`tools` 表的 `sandboxMode` 字段保留（数据库不删列），但 UI 中已隐藏选择器，运行时忽略该字段。

## 测试要点

- 纯同步 handler：`export default function(args) { return { result: args.x * 2 }; }`
- wiki 调用：`import { wiki } from "archon:context"; export default async function(args) { return await wiki.get(args.id); }`
- 非法访问：`export default function() { return process.env; }` → 静态扫描阻止
- 非法导入：`import fs from "fs";` → 静态扫描阻止
