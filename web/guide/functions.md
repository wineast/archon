# 函数（Functions）模块

函数是服务端可复用的 JavaScript 代码单元，可被工具 Handler 或其他函数调用。

## 概念

| 概念 | 说明 |
|------|------|
| **Function** | 一段可复用的 JavaScript 代码，有输入输出定义 |
| **Builtin Function** | 系统内置函数，不可编辑但可直接使用 |
| **Dynamic Function** | 用户自定义函数，可编辑代码和参数 |

## 数据库 Schema

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 关联 Agent |
| key | text | 函数唯一标识 |
| name | text | 函数名称 |
| description | text | 函数描述 |
| code | text | JavaScript 实现代码 |
| parametersSchema | jsonb | 输入参数 Schema（内联 JsonSchema7 或 `$ref`） |
| returnParametersSchema | jsonb | 返回值 Schema（内联 JsonSchema7 或 `$ref`） |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/functions?agentId=xxx` | 列出所有函数 |
| POST | `/api/functions` | 创建函数 |
| GET | `/api/functions/[id]` | 获取函数详情 |
| PATCH | `/api/functions/[id]` | 更新函数 |
| DELETE | `/api/functions/[id]` | 软删除函数 |

## 跨资源引用

### 导入其他函数（ES6 模块格式）

```js
import calc from "archon:fn/pricing_engine";
import validate from "archon:fn/input_validator";

export default function(input) {
  validate(input);
  return calc(input);
}
```

| 命名空间 | 用途 | 语法 |
|----------|------|------|
| `archon:fn/<key>` | 导入其他函数 | `import calc from "archon:fn/pricing_engine"` |
| `archon:lib/filtrex` | Filtrex 表达式引擎 | `import { compileExpression } from "archon:lib/filtrex"` |

函数间的依赖关系自动从 import 语句推断。编辑器提供 TypeScript 类型提示和自动补全。

### 旧闭包格式

```js
function fn({ pricing_engine, input_validator }) {
  return function(input) {
    input_validator(input);
    return pricing_engine(input);
  }
}
```

依赖通过解构参数名匹配其他函数的 key。

### 被其他资源引用

| 引用方 | 语法 | 说明 |
|--------|------|------|
| **Tool Handler（新格式）** | `import fn from "archon:fn/<key>"` | ES6 导入 |
| **Tool Handler（旧格式）** | `await context.fn("<key>")` | 动态加载 |
| **其他 Function** | `import fn from "archon:fn/<key>"` | 互相导入 |

> **注意**：函数本身**不能**使用 `archon:context`（wiki/dataset/ontology API）。只有 Tool Handler 才有 context 访问权限。函数是纯逻辑单元。

详见 [模块系统文档](../guide/module-system.md)。

---

## UI

在 Agent Build 页面侧栏中点击 **Functions**（函数图标）进入：

- 左侧侧栏：内置函数 + 自定义函数列表
- 右侧详情：代码编辑器、参数 Schema 关联、测试用例
