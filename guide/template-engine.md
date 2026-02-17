# 模板引擎使用文档

系统提示词、Wiki 文档、工具输出等均支持 LiquidJS 模板语法。你可以在文本中使用 `{{变量}}` 插值、`{% if %}` 条件、`{% for %}` 循环等语法，动态生成内容。

---

## 可使用模板语法的位置

以下位置的文本会经过 LiquidJS 渲染，支持模板语法：

| 位置 | 说明 | 可用数据 | 代码入口 |
|------|------|---------|---------|
| **系统提示词** | 模型配置的 `systemPrompt` 字段 | 全部（内置变量、模板变量、lookup、data、tool、`{% include %}` Wiki） | `renderTemplate()` — `chat/route.ts`、`eval/.../case/route.ts`、`template/preview/route.ts` |
| **Wiki 文档内容** | Wiki 编辑器中的文档正文 | 全部 + Wiki 专属变量（`documentTitle`、`documentCount`、`documentList`、`currentDate`、`currentTime`）；支持 `{% include '标题' %}` | `processTemplate()` — `wiki-editor.tsx`（预览）、`tool-context.ts`（工具运行时读取） |
| **工具静态输出** | 工具定义的 `output` 字段（无 handler 时作为返回值） | 全部 | `renderTemplate()` — `build-dynamic-tools.ts` |
| **评估 Judge 提示词** | Eval Judge 的 `systemPrompt` 字段 | 全部 + 额外变量（`model`、`caseName`、`toolNames`） | `renderTemplate()` — `eval/.../case/route.ts` |
| **码表条目** | Lookup Entry 的 `value`、`label`、`metadata` 字段 | **仅模板变量**（上下文中不含 lookup/data/tool 命名空间，不支持 `{% include %}`） | `renderEntryField()` / `renderMetadataField()` — `render.ts`、`tool-context.ts` |
| **数据对象** | Data Object JSON 内的值 | **仅模板变量**（上下文中不含 lookup/data/tool 命名空间，不支持 `{% include %}`） | `renderMetadataField()` — `render.ts`、`tool-context.ts` |
| **工具 JS Handler** | handler 为 JS 代码时，第二个参数 `context` 提供运行时数据访问 API | 通过 API 访问 wiki、lookup、data、vars（返回值已经过模板渲染） | `createToolContext()` — `tool-context.ts` |

> **注意**：码表和数据对象内的模板支持完整的 LiquidJS 语法（`{{ }}`、`{% if %}`、`{% for %}` 等），但渲染上下文中只注入了模板变量，不含 `lookup.*`、`data.*`、`tool.*` 命名空间，也不支持 `{% include %}` Wiki 文档。这是因为它们本身就是被其他模板引用的数据源，避免循环依赖。

---

## 一、变量插值

用双花括号引用变量：

```liquid
你好，欢迎使用 {{company}} 的服务。
今天是 {{date}}，当前时间 {{time}}。
```

### 内置变量（自动可用）

| 变量 | 示例值 | 说明 |
|------|--------|------|
| `{{date}}` | `2026-02-17` | 日期 |
| `{{time}}` | `14:30:00` | 时间 |
| `{{datetime}}` | `2026-02-17T14:30:00.000Z` | 完整时间 |
| `{{year}}` | `2026` | 年 |
| `{{month}}` | `02` | 月（补零） |
| `{{day}}` | `17` | 日（补零） |

### 模板变量（在管理后台配置）

支持四种类型：

| 类型 | 配置值示例 | 模板写法 |
|------|-----------|---------|
| 文本 | `Acme Corp` | `{{company}}` |
| 数字 | `0.85` | `{{max_ratio}}` |
| 布尔 | `true` | 用于条件判断 |
| JSON | `{"city":"LA","state":"CA"}` | `{{office.city}}`（点号访问） |

数组类型：任意类型勾选「是数组」后，配置值为 JSON 数组，可用于循环遍历。

**示例：**

假设配置了以下模板变量：

| key | 值 | 类型 |
|-----|----|------|
| `company` | `Acme Corp` | 文本 |
| `max_ratio` | `0.85` | 数字 |
| `bilingual` | `true` | 布尔 |
| `languages` | `["en","zh","es"]` | 文本数组 |
| `office` | `{"city":"LA","state":"CA"}` | JSON |

```liquid
欢迎使用 {{company}} 系统。
最大比率：{{max_ratio}}
办公地点：{{office.city}}, {{office.state}}
```

---

## 二、条件判断

```liquid
{% if bilingual %}
请使用双语回复。
{% endif %}
```

```liquid
{% if role == "admin" %}
你拥有管理员权限。
{% elsif role == "editor" %}
你拥有编辑权限。
{% else %}
你拥有只读权限。
{% endif %}
```

反向判断：

```liquid
{% unless debug %}
这是生产环境。
{% endunless %}
```

---

## 三、循环

```liquid
支持语言：
{% for lang in languages %}
- {{lang}}
{% endfor %}
```

循环内可用 `forloop` 对象：

```liquid
{% for item in items %}
{{forloop.index}}. {{item}}
{% endfor %}
```

| 属性 | 说明 |
|------|------|
| `forloop.index` | 从 1 开始的序号 |
| `forloop.index0` | 从 0 开始的序号 |
| `forloop.first` | 是否第一项 |
| `forloop.last` | 是否最后一项 |

---

## 四、码表

码表用于管理「机器码 / 显示名」分离的枚举选项。通过 `lookup.` 前缀访问。

假设码表 `income_type` 配置了：

| 值 (value) | 显示名 (label) | metadata |
|------------|----------------|----------|
| `W2` | `W2 工资收入` | `{"category": "employment"}` |
| `1099` | `1099 自雇收入` | `{"category": "self_employed"}` |

### 注入的变量

| 变量 | 类型 | 说明 |
|------|------|------|
| `lookup.{key}` | `string` | 所有 value 逗号拼接：`"W2, 1099"` |
| `lookup.{key}_label` | `string` | 所有 label 逗号拼接（无 label 时回退到 value）：`"W2 工资收入, 1099 自雇收入"` |
| `lookup.{key}_json` | `string` | 完整 JSON 字符串：`[{"value":"W2","label":"W2 工资收入","metadata":{...}}, ...]` |
| `lookup.{key}_entries` | `array` | 条目数组，用于 `{% for %}` 遍历 |

### entry 对象字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `entry.value` | `string` | 机器码 |
| `entry.label` | `string \| null` | 显示名 |
| `entry.metadata` | `object \| null` | 附加元数据，支持点号访问如 `entry.metadata.category` |

### 用法示例

```liquid
{{lookup.income_type}}
→ W2, 1099

{{lookup.income_type_label}}
→ W2 工资收入, 1099 自雇收入

{{lookup.income_type_json}}
→ [{"value":"W2","label":"W2 工资收入","metadata":{"category":"employment"}}, ...]

{% for entry in lookup.income_type_entries %}
- {{entry.value}}: {{entry.label}} ({{entry.metadata.category}})
{% endfor %}
→ - W2: W2 工资收入 (employment)
  - 1099: 1099 自雇收入 (self_employed)
```

**码表字段内引用模板变量：**

| 值 | 显示名 |
|----|--------|
| `{{company}}_standard` | `{{company}} 标准版` |

渲染后自动替换为对应变量值。metadata 字段内的值同样支持模板变量替换。

---

## 五、数据对象

数据对象用于存储任意嵌套 JSON。通过 `data.` 前缀访问。

假设数据对象 `product` 的数据为：

```json
{
  "universe": { "label": "全能贷", "rate": 0.05 },
  "express": { "label": "快捷贷", "rate": 0.08 }
}
```

### 注入的变量

| 变量 | 类型 | 说明 |
|------|------|------|
| `data.{key}` | `object` | 渲染后的原始对象，支持任意层级点号访问 |
| `data.{key}_json` | `string` | 渲染后的 JSON 字符串 |
| `data.{key}_entries` | `array` | 虚拟条目数组，用于 `{% for %}` 遍历 |

### _entries 条目字段

遍历时每个条目的字段由对象的顶层 key 映射而来：

| 字段 | 类型 | 来源 |
|------|------|------|
| `e.value` | `string` | 对象的 key（如 `"universe"`） |
| `e.label` | `string \| null` | 对象值中的 `.label` 字段（如 `"全能贷"`），无则为 null |
| `e.metadata` | `object` | 对象值本身（如 `{ "label": "全能贷", "rate": 0.05 }`） |

### 用法示例

```liquid
{{data.product.universe.label}}
→ 全能贷

{{data.product.universe.rate}}
→ 0.05

{{data.product_json}}
→ {"universe":{"label":"全能贷","rate":0.05}, ...}

{% for e in data.product_entries %}
- {{e.value}}: {{e.label}}（利率 {{e.metadata.rate}}）
{% endfor %}
→ - universe: 全能贷（利率 0.05）
  - express: 快捷贷（利率 0.08）
```

数据字段内同样可引用模板变量。

---

## 六、工具信息

通过 `tool.` 前缀访问已启用工具的定义信息。

### 单个工具 `tool.{name}`

| 变量 | 类型 | 说明 |
|------|------|------|
| `tool.{name}.name` | `string` | 工具名称 |
| `tool.{name}.description` | `string` | 工具描述 |
| `tool.{name}.params` | `string` | 参数名逗号拼接：`"income, expenses, debt"` |
| `tool.{name}.parameters` | `array` | 参数定义数组，用于 `{% for %}` 遍历 |
| `tool.{name}.json` | `string` | 完整 JSON 字符串：`{"name":...,"description":...,"parameters":[...]}` |

### parameters 条目字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `p.name` | `string` | 参数名 |
| `p.type` | `string` | 参数类型（`string`、`number`、`boolean` 等） |
| `p.description` | `string` | 参数描述 |
| `p.required` | `boolean` | 是否必填 |
| `p.enum` | `string[] \| undefined` | 可选枚举值列表（无枚举时不存在） |

### 全局辅助变量

| 变量 | 类型 | 说明 |
|------|------|------|
| `tool_names` | `string` | 所有已启用工具名逗号拼接：`"calculate_dti, route_loan_products"` |
| `tool_entries` | `array` | 工具概要数组，用于 `{% for %}` 遍历 |

### tool_entries 条目字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `t.name` | `string` | 工具名称 |
| `t.description` | `string` | 工具描述 |
| `t.params` | `array` | 简化参数数组 `[{ name, type }]` |

### 用法示例

```liquid
工具名：{{tool.calculate_dti.name}}
工具描述：{{tool.calculate_dti.description}}
参数列表：{{tool.calculate_dti.params}}

{% for p in tool.calculate_dti.parameters %}
- {{p.name}} ({{p.type}}{% if p.required %}, 必填{% endif %}): {{p.description}}
{% endfor %}
```

全局遍历：

```liquid
可用工具：{{tool_names}}

{% for t in tool_entries %}
### {{t.name}}
{{t.description}}
参数：{% for p in t.params %}{{p.name}}({{p.type}}){% unless forloop.last %}, {% endunless %}{% endfor %}
{% endfor %}
```

---

## 七、工具 Handler Context API

当工具的 handler 为 JS 代码时，函数签名为 `(args, context) => result`。第二个参数 `context` 提供运行时数据访问 API，返回值已经过模板变量渲染。

### context.wiki

```js
// 按 ID 获取单篇文档（content 经过完整模板渲染，含 include 展开）
const doc = await context.wiki.get("doc-id");
// → { meta: { ... } | null, content: "渲染后的正文" }

// 按 ID 前缀批量查找（content 为原始正文，未渲染）
const docs = await context.wiki.findByPrefix("product-");
// → [{ id, title, meta, content }, ...]

// 按内容搜索（content 为原始正文，未渲染）
const results = await context.wiki.search("关键词");
// → [{ id, title, meta, content }, ...]
```

### context.lookup

```js
// 获取码表全部条目（value/label/metadata 已渲染模板变量）
const entries = await context.lookup.get("income_type");
// → [{ value: "W2", label: "W2 工资收入", metadata: { ... } | null }, ...]

// 按 metadata 字段过滤
const filtered = await context.lookup.find("income_type", { category: "employment" });
```

### context.data

```js
// 获取数据对象全部条目（值已渲染模板变量）
const entries = await context.data.get("product_routes");
// → [{ value: "universe", label: "全能贷", metadata: { rate: 0.05, ... } }, ...]

// 按 metadata 字段过滤
const filtered = await context.data.find("product_routes", { channel: "retail" });
```

### context.vars

```js
// 获取单个模板变量的值
const company = await context.vars.get("company_name");
// → "Acme Corp" | null
```

> **注意**：`wiki.get()` 返回的 content 经过完整模板渲染（含 `{% include %}`），而 `wiki.findByPrefix()` 和 `wiki.search()` 返回的 content 是原始正文（仅去除 frontmatter），不经过渲染。

---

## 八、引用 Wiki 文档

在模板中嵌入其他 Wiki 文档的内容：

```liquid
{% include '贷款指南' %}
```

按文档标题精确匹配。支持嵌套引用（A 引用 B，B 引用 C），系统自动检测循环引用。

---

## 九、Filter

支持 LiquidJS 内置 filter，用管道符 `|` 连接：

```liquid
{{languages | join: "、"}}
→ en、zh、es

{{company | upcase}}
→ ACME CORP

{{description | truncate: 50}}
→ 这是一段很长的描述文字，会被截断到五十个字符...
```

---

## 十、数据分层

模板变量是基础层，码表和数据对象可以引用模板变量的值：

```
模板变量（先解析）→ 码表/数据对象（引用模板变量）→ 最终模板（引用所有数据）
```

例如：数据对象中写 `{{income_type_enum.w2}}`，会先从 JSON 类型模板变量 `income_type_enum` 取值，再作为数据对象的字段值暴露。

---

## 十一、变量优先级

当同名变量存在多个来源时，按以下优先级（高覆盖低）：

1. 调用时传入的额外变量（最高）
2. 模板变量（管理后台配置）
3. 内置变量（最低）

`lookup.*`、`data.*`、`tool.*` 为独立命名空间，不受上述覆盖影响。

---

## 十二、注意事项

- **命名空间保留字**：`data`、`lookup`、`tool`、`tool_names`、`tool_entries` 不能用作模板变量的 key
- **码表不支持点号取值**：不能写 `{{lookup.income_type.W2}}`，只能遍历或逗号拼接
- **未定义变量**：引用不存在的变量会渲染为空字符串，不会报错
- **语法错误**：模板语法错误时返回原始文本，不影响系统正常运行
