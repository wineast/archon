# 内容引用与数据复用速查

梳理项目中所有内容引用、数据复用的机制，以及每种机制的语法、使用位置和可用数据。

---

## 总览：引用/复用机制

| # | 机制 | 语法 | 作用 | 使用位置 |
|---|------|------|------|---------|
| 1 | 模板变量 | `{{key}}` / `{{key.field}}` | 引用数据集值、内置变量、工具元数据 | 系统提示词、Wiki、技能、Judge、数据集 |
| 2 | 模板 include | `{% include 'doc' %}` | 嵌入 Wiki 文档内容（支持嵌套、防循环） | 系统提示词、Wiki、技能、Judge |
| 3 | Schema $ref | `"$ref": "#/$defs/key"` | JSON Schema 类型定义复用（支持递归 + z.lazy） | 工具参数、函数参数、组件 schema |
| 4 | Schema enum 展开 | `enum: ["{{key}}"]` | 数据集值展开为枚举选项 | 工具参数 schema |
| 5 | 代码 import | `import x from "archon:*"` | JS 模块引用（函数互调、Context API、UI 组件） | 工具 handler、函数、组件 |
| 6 | 运行时 Context API | `context.wiki.get()` 等 | 代码中异步访问平台数据 | 工具 handler |
| 7 | 宿主通信 | `postMessage` | embed 场景，宿主页面注入上下文数据 | 系统提示词、技能 |

---

## 一、模板变量 `{{key}}`

LiquidJS 模板引擎，通过 `{{ }}` 输出变量、`{% %}` 控制流。

### 可用变量（完整集）

| 变量 | 类型 | 说明 |
|------|------|------|
| `date` | `string` | `"2026-02-17"` |
| `time` | `string` | `"14:30:00"` |
| `datetime` | `string` | `"2026-02-17T14:30:00.000Z"` |
| `timestamp` | `string` | Unix 毫秒时间戳 |
| `year` | `string` | `"2026"` |
| `month` | `string` | `"02"`（补零） |
| `day` | `string` | `"17"`（补零） |
| `{dataset_key}` | any | 数据集值（拓扑排序后解析） |
| `tool.{name}.name` | `string` | 工具名称 |
| `tool.{name}.description` | `string` | 工具描述 |
| `tool.{name}.params` | `string` | 参数名逗号拼接 |
| `tool.{name}.parameters` | `array` | 参数定义数组 |
| `tool.{name}.json` | `string` | 工具完整 JSON |
| `tool_names` | `string` | 所有工具名逗号拼接 |
| `tool_entries` | `array` | 工具概要数组 |
| `ontology_types` | `array` | 本体论类型数组 |
| `ontology.{key}` | `object` | 按 key 访问本体论类型 |
| `host` | `object` | 宿主上下文（embed 场景） |

### Filter（管道语法）

支持 LiquidJS 内置 filter + 自定义 filter，用 `|` 连接：

```liquid
{{languages | join: "、"}}
{{company_name | upcase}}
{{description | truncate: 50}}
```

**自定义 filter**：`json`（`JSON.stringify`）、`keys`（`Object.keys()`）、`values`（`Object.values()`）。用于 schema enum 场景的显式展开。

### 各位置的变量范围

| 位置 | 来源 | 渲染时机 | 代码入口 | 可用范围 |
|------|------|---------|---------|---------|
| **系统提示词** | 模型配置 `systemPrompt` | 对话开始时 | `renderTemplate()` → `renderWithData()` → `processTemplate()` | 全部变量 |
| **Wiki 文档** | Wiki 编辑器正文 | `context.wiki.get()` 时 / 编辑器预览时 | 服务端 `renderWikiContent()`；客户端 `processTemplate()` | 全部变量 + Wiki 专属变量¹ |
| **技能 content** | 技能 `content` 字段 | 调用 `get_skill_detail` 时 | `renderTemplate(matched.content, templateData, { host })` | 全部变量（与系统提示词一致） |
| **Judge 提示词** | Eval Judge 配置 `systemPrompt` | eval 执行时 | `renderTemplate(judgeConfig.systemPrompt, templateData, extraVars)` | 全部变量 + eval 专用变量² |
| **数据集 data** | 数据集 `data` 字段 | `resolveDatasets()` 拓扑排序时 | `renderField()` / `renderObjectField()` | 仅前序数据集³ |

**注释**：
1. Wiki 专属变量：`currentDate`、`currentTime`、`documentTitle`、`documentCount`、`documentList`。客户端预览仅注入这些，不含数据集/工具/本体论
2. Judge 额外变量：`model`、`caseName`、`toolNames`、前端传入的 `templateVars`
3. 数据集不可用：内置时间变量、`tool.*` 命名空间、`ontology`、`{% include %}`

### 变量优先级

当同名变量存在多个来源时，高覆盖低：

1. 调用时传入的额外变量（最高）
2. Layer 1 数据集（渲染后）
3. Layer 0 数据集
4. 内置变量（最低）

`tool.*` 为独立命名空间，不受覆盖影响。

---

## 二、模板 include `{% include %}`

按文档标题嵌入 Wiki 文档内容：

```liquid
{% include '贷款指南' %}
```

- **精确匹配**文档标题
- **嵌套引用**：A → B → C，系统自动展开
- **循环检测**：A → B → A 会报错
- **Frontmatter**：include 时自动剥离
- **代码入口**：`web/src/lib/wiki/template.ts` 注册自定义 tag
- **使用位置**：系统提示词、Wiki、技能、Judge（数据集不支持）

---

## 三、Schema $ref

JSON Schema 类型定义复用，通过 `$ref` 引用 `$defs` 中定义的子 schema：

```json
{
  "type": "object",
  "properties": {
    "address": { "$ref": "#/$defs/address_schema_key" }
  }
}
```

- **解析方式**：`#/$defs/key` → 从 `defsMap` 查找对应 schema
- **递归支持**：通过 `z.lazy()` 实现，含循环检测
- **代码入口**：`web/src/lib/schemas/resolve-inline.ts`（内联解析）、`web/src/lib/tools/schema-builder.ts`（`buildRefSchema()`）
- **使用位置**：工具参数 schema、函数参数 schema、组件 schema

---

## 四、Schema enum 展开

工具参数 schema 的 `enum` 字段支持 LiquidJS 模板 + filter，通过 filter 显式声明展开意图。

- **来源**：工具定义的 `parameters` JSON Schema 中的 `enum` 字段
- **渲染时机**：`buildDynamicTools()` 构建 Zod schema 时
- **代码入口**：`resolveEnumValues()` — `schema-builder.ts`（调用 `renderField()` 渲染模板）
- **编辑器支持**：`InlineSchemaEditor` 提供 `{{}}` 模板补全（含 dot 语法嵌套字段）、Edit/Preview 切换（调用 `/api/schema/template/preview`）、GuideDialog

**语法**：enum 数组中包含 `{{ }}` 的元素会经过 LiquidJS 渲染，使用 `json` filter 输出 JSON 数组字符串：

```json
{
  "type": "string",
  "enum": ["{{ state_enum | json }}"]
}
```

**展开规则**：

| 写法 | 适用场景 | 示例 |
|------|---------|------|
| `{{ arr \| json }}` | 数组直接展开 | `["CA","TX"]` → `enum: ["CA","TX"]` |
| `{{ obj \| keys \| json }}` | 取对象 keys | `{"CA":"California"}` → `enum: ["CA","TX"]` |
| `{{ obj \| values \| json }}` | 取对象 values | `{"CA":"California"}` → `enum: ["California","Texas"]` |
| `{{ arr \| map: "field" \| json }}` | 取数组对象的某字段 | `[{name:"A"},{name:"B"}]` → `enum: ["A","B"]` |
| 非模板字符串 | 保留原值 | `"fixed_value"` → `enum: ["fixed_value"]` |

渲染结果为合法 JSON 数组字符串（`[` 开头）时，解析后 spread 为多个枚举值；否则作为字面量字符串使用。

**可用数据**：仅数据集 `resolvedVars`（不含内置变量、工具、本体论）。

---

## 五、代码 import `archon:*`

工具 handler、函数、组件中通过 ES module `import` 语法引用平台资源。

### 工具 handler

- **运行环境**：QuickJS WASM 沙箱（asyncified 模式）
- **函数签名**：`(args, context) => result` 或 ES module 格式

| import 语句 | 转换后 | 说明 |
|------------|--------|------|
| `import { wiki, dataset } from "archon:context"` | `var wiki = __context.wiki; ...` | 上下文 API |
| `import { fn } from "archon:context"` | `var fn = __context.fn;` | 函数加载器 |
| `import { ontology } from "archon:context"` | `var ontology = __context.ontology;` | 本体论 CRUD |
| `import calc from "archon:fn/calc"` | `var calc = __context.fn("calc");` | 直接导入指定函数 |

### 函数

- **运行环境**：QuickJS WASM 沙箱（`resolveAndCompileFunctions()` 预编译）
- **纯计算单元**：不支持 `archon:context`，需要数据时由调用方传入

| import 语句 | 说明 |
|------------|------|
| `import xxx from "archon:fn/{key}"` | 导入其他函数（按 key），支持链式依赖，系统自动拓扑排序 |

**ES module 格式（推荐）**：

```js
import dep from "archon:fn/dep_function_key"

export default function(input) {
  return dep(input) * 2;
}
```

### 组件

| import 语句 | 转换后 | 说明 |
|------------|--------|------|
| `import X from "archon:xxx"` | `const X = __deps__["archon:xxx"].default` | 默认导入 |
| `import { A, B } from "archon:xxx"` | `const { A, B } = __deps__["archon:xxx"]` | 具名导入 |

**可用虚拟模块**：`archon:react`、`archon:ui`、`archon:icons`、`archon:fn/{key}`、`archon:component/{key}`

---

## 六、运行时 Context API

工具 handler 通过 `import { wiki, dataset, fn, ontology } from "archon:context"` 获取，运行时异步访问平台数据。

### `context.wiki`

```js
const doc = await context.wiki.get("doc-id");
// → { meta: object | null, content: string }（content 已渲染，含 include 展开）

const docs = await context.wiki.findByPrefix("product-");
// → [{ id, title, meta, content }, ...]（content 未渲染）

const results = await context.wiki.search("关键词");
// → [{ id, title, meta, content }, ...]（content 未渲染）
```

### `context.dataset`

```js
const val = await context.dataset.get("company_name");
// → "GMCC" | null

const entries = await context.dataset.getEntries("product_routes");
// → [{ value: string, label: string | null, metadata: object }, ...]
```

### `context.fn`

```js
const calc = await context.fn("pricing_engine");
const result = await calc({ income: 50000 });
```

### `context.ontology`

```js
// 类型定义
const types = await context.ontology.types();           // 所有类型
const type = await context.ontology.type("customer");   // 单个类型

// 对象 CRUD
const results = await context.ontology.query("customer", { where: ... });
const obj = await context.ontology.get("customer", id);
const created = await context.ontology.create("customer", { name: "..." });
const updated = await context.ontology.update("customer", id, { name: "..." });
await context.ontology.delete("customer", id);

// 关系管理
await context.ontology.link(sourceType, sourceId, relation, targetId);
await context.ontology.unlink(sourceType, sourceId, relation, targetId);
const graph = await context.ontology.graph(type, id, depth);
```

---

## 七、宿主通信 postMessage

embed 嵌入场景，Archon 以 iframe 嵌入宿主页面。宿主页面加载 `widget.js`，通过 postMessage 与 iframe 双向通信。包含两个独立功能：

### 功能 1：上下文注入

宿主页面把业务上下文传给 Archon，让 AI 知道"用户是谁、在哪个页面"：

```js
// 宿主页面代码
ArchonEmbed.setContext({
  currentPage: '/products/123',
  userName: 'Alice',
  cartItems: 3
});
```

数据流：`setContext()` → postMessage `archon:context` → iframe 存入内存 → 用户发消息时随请求发送到后端 → 后端渲染模板时注入为 `host` 变量

系统提示词中使用：

```liquid
当前用户：{{host.userName}}，正在浏览：{{host.currentPage}}
```

**单向**：宿主传数据进来，模板里读取。仅系统提示词和技能 content 可用。

### 功能 2：宿主工具

宿主页面注册 JS 函数，让 AI 能调用宿主系统的能力（如操作购物车、跳转页面）：

```js
// 宿主页面代码
ArchonEmbed.registerTools({
  addToCart: async ({ productId, quantity }) => {
    const result = await fetch('/api/cart/add', { ... });
    return { success: true, cartSize: result.cartSize };
  }
});
```

AI 调用时的完整链路：

1. AI 决定调用 `addToCart` → iframe 发送 `archon:tool-call` → 宿主页面
2. 宿主执行对应的 JS 函数
3. 宿主发送 `archon:tool-result`（或 `archon:tool-error`）→ iframe → 结果返回给 AI

**双向**：AI 发起调用，宿主执行，结果返回。工具需在 Archon 后台定义（`executionTarget = "host"`）且宿主页面注册，双重校验后 AI 才可见。

### 通信协议

| 方向 | 消息类型 | 作用 |
|------|---------|------|
| iframe → 宿主 | `archon:ready` | iframe 加载完毕，宿主可以开始发消息 |
| 宿主 → iframe | `archon:context` | 传入上下文数据（`setContext`） |
| 宿主 → iframe | `archon:tools-register` | 注册可调用的工具名列表 |
| iframe → 宿主 | `archon:tool-call` | AI 要调用宿主工具 |
| 宿主 → iframe | `archon:tool-result` / `archon:tool-error` | 工具执行结果返回 |

### 安全与限制

- **来源校验**：iframe 校验 `embedTokens.allowedOrigins`，widget.js 校验 Archon 域名
- **上下文大小**：hostContext 限 10KB
- **工具超时**：30 秒未返回自动报错

### 关键文件

| 文件 | 作用 |
|------|------|
| `web/public/embed/widget.js` | 宿主侧脚本，bubble UI + postMessage API |
| `web/src/app/(nonlocale)/embed/[agentId]/page.tsx` | iframe 页面，消息监听 + 工具执行 |
| `web/src/lib/chat/execute-stream.ts` | 后端：hostContext 注入模板、过滤宿主工具 |

---

## 附录 A：变量注入矩阵

| 变量来源 | 系统提示词 | Wiki | 技能 | Judge | 数据集 | Schema enum | 工具 handler | 函数 |
|---------|:---------:|:----:|:----:|:-----:|:-----:|:----------:|:-----------:|:----:|
| 内置时间变量 | ✅ | ✅¹ | ✅ | ✅ | ❌ | ❌ | ❌² | ❌ |
| 数据集 | ✅ | ✅¹ | ✅ | ✅ | ✅³ | ✅ | ❌² | ❌ |
| `tool.*` | ✅ | ✅¹ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `tool_names` / `tool_entries` | ✅ | ✅¹ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `ontology_types` / `ontology` | ✅ | ✅¹ | ✅ | ✅ | ❌ | ❌ | ❌² | ❌ |
| `host` | ✅⁴ | ❌ | ✅⁴ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `model` / `caseName` / `toolNames` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Wiki 专属变量 | ✅⁵ | ✅ | ✅⁵ | ✅⁵ | ❌ | ❌ | ❌ | ❌ |
| `{% include %}` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `context.wiki` | — | — | — | — | — | — | ✅ | ❌ |
| `context.dataset` | — | — | — | — | — | — | ✅ | ❌ |
| `context.fn` | — | — | — | — | — | — | ✅ | ❌ |
| `context.ontology` | — | — | — | — | — | — | ✅ | ❌ |
| `archon:fn/*` import | — | — | — | — | — | — | ✅ | ✅ |

**注释**：
1. Wiki 服务端渲染注入全部变量；客户端预览仅注入 Wiki 专属变量
2. 工具 handler 不通过模板注入，而是通过 `context` API 异步访问
3. 数据集仅可引用拓扑排序中的前序数据集
4. 仅 embed 嵌入场景，宿主通过 postMessage 传入
5. 经过 `processTemplate()` 的 `buildContext` 注入

---

## 附录 B：编辑器补全

| 位置 | 编辑器 | `{{` 补全 | `.` 点号补全 | 补全内容 | 渲染注入 | 一致性 |
|------|--------|:---------:|:----------:|---------|---------|:------:|
| 系统提示词 | MdEditor | ✅ | ✅ | 内置变量 + 数据集 + 工具 + 文档 | 全部 | ✅ |
| Wiki 文档 | MdEditor | ✅ | ✅ | 内置变量 + 数据集 + 工具 + 文档 | 客户端仅 Wiki 专属变量 | ⚠️¹ |
| 技能 content | MdEditor | ✅ | ✅ | 内置变量 + 数据集 + 工具 + 文档 | 全部 | ✅ |
| Judge 提示词 | MdEditor | ✅ | ✅ | 内置变量 + 工具名 + 数据集 + 文档 | 全部 + eval 专用变量 | ✅ |
| 数据集 data | JsonEditor | ✅ | ✅ | 仅数据集 keys | 仅前序数据集 | ✅ |
| Schema enum | InlineSchemaEditor | ✅ | ✅ | 仅数据集 keys | 仅数据集 resolvedVars | ✅ |

**补全实现**：`completions.ts` 提供统一补全，触发字符：`{`、`%`、` `（空格）、`.`（点号）。点号补全通过 `variableMap`（`Record<string, unknown>`）实现——输入 `{{key.` 自动展开对象子字段。

1. Wiki 客户端预览仅 Wiki 专属变量，服务端一致
