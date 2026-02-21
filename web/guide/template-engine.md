# 模板引擎使用文档

系统提示词、Wiki 文档、工具输出等均支持 LiquidJS 模板语法。你可以在文本中使用 `{{变量}}` 插值、`{% if %}` 条件、`{% for %}` 循环等语法，动态生成内容。

---

## 可使用模板语法的位置

以下位置的文本会经过 LiquidJS 渲染，支持模板语法：

| 位置 | 说明 | 可用数据 | 代码入口 |
|------|------|---------|---------|
| **系统提示词** | 模型配置的 `systemPrompt` 字段 | 全部（内置变量、数据集、tool、`{% include %}` Wiki） | `renderTemplate()` — `chat/route.ts`、`eval/.../case/route.ts`、`template/preview/route.ts` |
| **Wiki 文档内容** | Wiki 编辑器中的文档正文 | 全部 + Wiki 专属变量（`documentTitle`、`documentCount`、`documentList`、`currentDate`、`currentTime`）；支持 `{% include '标题' %}` | `processTemplate()` — `wiki-editor.tsx`（预览）、`tool-context.ts`（工具运行时读取） |
| **评估 Judge 提示词** | Eval Judge 的 `systemPrompt` 字段 | 全部 + 额外变量（`model`、`caseName`、`toolNames`） | `renderTemplate()` — `eval/.../case/route.ts` |
| **数据集模板** | data 字段内含 `{{ }}` 的数据集 | **所有已解析的前序数据集**（拓扑排序，不含 tool 命名空间，不支持 `{% include %}`） | `renderField()` / `renderObjectField()` — `datasets/queries.ts` |
| **工具 JS Handler** | handler 为 JS 代码时，第二个参数 `context` 提供运行时数据访问 API | 通过 API 访问 wiki、dataset（返回值已经过模板渲染） | `createToolContext()` — `tool-context.ts` |

> **注意**：数据集模板支持完整的 LiquidJS 语法（`{{ }}`、`{% if %}`、`{% for %}` 等），支持互相引用（系统使用 Kahn 拓扑排序，按依赖顺序逐个渲染，支持 N 层深度链式引用，循环依赖会报错）。但渲染上下文不含 `tool.*` 命名空间，也不支持 `{% include %}` Wiki 文档，避免与最终模板渲染产生循环依赖。

---

## 一、数据集（Datasets）

所有配置数据统一存储在 **数据集** 中。数据集分为两类：

| 类型 | 存储内容 | 模板语法 | 示例 |
|------|---------|---------|------|
| **基础数据集** | 原子化基础值（纯 JSON，不含模板） | 无 | `"GMCC"`, `{"w2":"Full Doc..."}` |
| **派生数据集** | 含 Liquid 模板的 JSON，渲染后产出最终值 | `{{key}}`、`{% for %}`、`{% if %}` 等 | `{"incomes":["{{income_type_enum.w2}}"]}` |

> 数据库中不区分层级——系统通过 Kahn 拓扑排序自动识别依赖关系，按顺序渲染。

### 引用方式（扁平命名空间）

所有数据集通过 key 直接引用，不需要前缀：

```liquid
{{company_name}}
→ GMCC

{{income_type_enum.w2}}
→ Full Doc - W2 Wage Earner
```

### 数据类型

数据集的 `data` 字段是任意合法 JSON：

| 数据类型 | 配置值示例 | 模板写法 |
|---------|-----------|---------|
| 字符串 | `"Acme Corp"` | `{{company_name}}` |
| 对象 | `{"CA":"CA","TX":"TX"}` | `{{state_enum.CA}}`（点号访问） |
| 数组 | `["en","zh","es"]` | 用于循环遍历 |

### 数据集引用链

数据集支持互相引用，系统自动通过拓扑排序确定渲染顺序：

```
a = "Root"（基础，无依赖）
b = "{{a}}-Mid"（引用 a）        → "Root-Mid"
c = "{{b}}-End"（引用 b）        → "Root-Mid-End"
最终模板（引用所有已解析数据集 + 工具）
```

例如：数据集 `product_routes` 中写 `{{income_type_enum.w2}}`，会从数据集 `income_type_enum` 取值。支持 N 层深度链式引用，循环依赖会报错。

---

## 二、变量插值

用双花括号引用变量：

```liquid
你好，欢迎使用 {{company_name}} 的服务。
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

---

## 三、条件判断

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

## 四、循环

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

## 五、工具信息

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

## 六、工具 Handler Context API

当工具的 handler 为 JS 代码时，函数签名为 `(args, context) => result`。第二个参数 `context` 提供运行时数据访问 API，返回值已经过模板渲染。

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

### context.dataset

```js
// 获取数据集值（已解析 layer 引用）
const company = await context.dataset.get("company_name");
// → "GMCC" | null

// 获取对象类型数据集的条目列表
const entries = await context.dataset.getEntries("product_routes");
// → [{ value: "universe", label: "GMCC Universe", metadata: { incomes: [...], states: [...] } }, ...]
```

`getEntries()` 将对象类型数据集转换为条目数组：

| 字段 | 类型 | 来源 |
|------|------|------|
| `e.value` | `string` | 对象的 key（如 `"universe"`） |
| `e.label` | `string \| null` | 对象值中的 `.label` 字段（如 `"GMCC Universe"`），无则为 null |
| `e.metadata` | `object` | 对象值本身（如 `{ "label": "GMCC Universe", "incomes": [...] }`） |

> **注意**：`wiki.get()` 返回的 content 经过完整模板渲染（含 `{% include %}`），而 `wiki.findByPrefix()` 和 `wiki.search()` 返回的 content 是原始正文（仅去除 frontmatter），不经过渲染。

---

## 七、引用 Wiki 文档

在模板中嵌入其他 Wiki 文档的内容：

```liquid
{% include 'loan_guide' %}
```

按文档 **key** 精确匹配。支持嵌套引用（A 引用 B，B 引用 C），系统自动检测循环引用。

---

## 八、Filter

支持 LiquidJS 内置 filter，用管道符 `|` 连接：

```liquid
{{languages | join: "、"}}
→ en、zh、es

{{company_name | upcase}}
→ ACME CORP

{{description | truncate: 50}}
→ 这是一段很长的描述文字，会被截断到五十个字符...
```

### 自定义 Filter

除 LiquidJS 内置 filter 外，系统还注册了以下自定义 filter：

| Filter | 输入 | 输出 | 说明 |
|--------|------|------|------|
| `json` | 任意值 | JSON 字符串 | `JSON.stringify(value)` |
| `keys` | 对象 | 字符串数组 | `Object.keys()`；数组/其他值原样返回 |
| `values` | 对象 | 值数组 | `Object.values()`；数组/其他值原样返回 |

> `map` 是 LiquidJS 内置 filter，无需自定义。

### Schema enum 场景

工具参数 schema 的 `enum` 字段支持 LiquidJS 模板 + filter，显式声明展开意图：

```liquid
{{ state_enum | json }}              → 数组直接序列化为 JSON 数组
{{ product_map | keys | json }}      → 取对象 keys
{{ product_map | values | json }}    → 取对象 values
{{ products | map: "name" | json }}  → 取每个对象的某个字段
```

**示例**：数据集 `state_enum = ["CA", "NY", "TX"]`，工具参数 schema：

```json
{
  "type": "string",
  "enum": ["{{ state_enum | json }}"]
}
```

渲染后等价于 `enum: ["CA", "NY", "TX"]`。

**规则**：enum 元素中包含 `{{ }}` 的字符串会经过 LiquidJS 渲染。若渲染结果是合法 JSON 数组字符串（`[` 开头），则解析后展开为多个枚举值；否则作为字面量字符串使用。不含 `{{ }}` 的元素保留原值。

---

## 九、变量优先级

当同名变量存在多个来源时，按以下优先级（高覆盖低）：

1. 调用时传入的额外变量（最高）
2. Layer 1 数据集（渲染后）
3. Layer 0 数据集
4. 内置变量（最低）

`tool.*` 为独立命名空间，不受上述覆盖影响。

---

## 十、注意事项

- **命名空间保留字**：`tool`、`tool_names`、`tool_entries` 不能用作数据集的 key
- **未定义变量**：引用不存在的变量会渲染为空字符串，不会报错
- **语法错误**：模板语法错误时返回原始文本，不影响系统正常运行
- **编辑器补全 ↔ 预览一致性**：每种模板编辑场景的补全提示和预览渲染必须注入相同的变量集。数据集 data 编辑器只提供前序数据集的补全和渲染，不包含内置变量（`date`/`time` 等）和 `tool.*`；系统提示词编辑器则提供全部变量
