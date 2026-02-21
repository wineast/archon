# Schema 使用指南

Schema 是系统的可复用参数定义层。工具（Tool）、函数（Function）、对象类型（Object Type）共享同一套 Schema 机制来描述数据结构。Schema 定义直接存储为标准 **JSON Schema 7** 格式（JSONB），运行时转换为 Zod 校验，形成双层架构。

---

## 核心概念依赖关系

Schema 是 Archon 数据架构中的基础层之一。以下是 Schema 与其他核心概念之间的依赖关系全景：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         System Prompt（最终产物）                        │
│  modelConfig.systemPrompt 经 LiquidJS 渲染后发送给 LLM                  │
│                                                                         │
│  渲染时注入的数据源：                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Datasets │  │   Wiki   │  │  Tools   │  │  Skills  │  │ Ontology │ │
│  │ 变量插值  │  │ include  │  │tool_names│  │ 摘要列表  │  │ 类型定义  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────────────┘

依赖关系图（→ 表示"被…使用"）：

  Schemas ──→ Tools（parametersSchema 内 $ref 引用）
          ──→ Functions（parametersSchema 内 $ref 引用）
          ──→ Components（inputSchema / outputSchema 内 $ref 引用）
          ──→ Ontology（schemaId FK，对象类型的属性结构）
          ──→ Schemas 自身（$ref 互相引用）

  Datasets ──→ Schemas（enum 模板字符串 "{{dataset_key}}"）
           ──→ System Prompt（变量插值）
           ──→ Wiki（模板渲染）
           ──→ Skills（模板渲染）
           ──→ Tool Handlers（context.dataset.get()）
           ──→ Datasets 自身（拓扑排序，支持 N 层深度互相引用）

  Wiki ──→ System Prompt（{% include '文档标题' %}）
       ──→ Tool Handlers（context.wiki.get()）
       ──→ Wiki 自身（嵌套 include）

  Functions ──→ Tools（handler 中 import "archon:fn/key"）
            ──→ Functions 自身（互相 import）

  Tools ──→ System Prompt（tool_names、tool.*、tool_entries）
        ──→ Skills（模板中引用 tool 信息）

  Skills ──→ System Prompt（摘要注入 + get_skill_detail 按需加载）

  Ontology ──→ System Prompt（ontology_types 变量）
           ──→ Tool Handlers（context.ontology）

  Model Config ──→ System Prompt（systemPrompt 模板 + 模型选择 + temperature）
```

### 数据流方向

```
用户发消息
  │
  ▼
加载 active ModelConfig
  │
  ▼
gatherTemplateData(agentId) ─── 一次性加载所有数据源
  ├── Datasets: 拓扑排序 → 按依赖顺序逐个渲染 → resolvedVars
  ├── Schemas: 构建 defsMap（$ref 解析用）
  ├── Wiki: 原始文档（按需渲染）
  ├── Tools: 定义信息（tool_names, tool.*, tool_entries）
  ├── Ontology: 类型 + 关系
  └── Skills: 摘要列表
  │
  ▼
renderTemplate(systemPrompt, templateData) → 最终系统提示词
  │
  ▼
buildDynamicTools() → 构建工具 Zod Schema（使用 defsMap + resolvedVars）
  │
  ▼
发送给 LLM（系统提示词 + 工具定义 + 用户消息）
```

### 关键规则

- **Schemas** 是纯结构定义，不依赖任何其他概念（基础层）
- **Datasets** 是纯数据（基础层）；支持互相引用（通过 Kahn 拓扑排序，按依赖顺序逐个渲染，支持 N 层深度链式引用，循环依赖会报错）
- **Wiki** 可引用 Datasets 和其他 Wiki（通过模板语法）
- **Tools** 依赖 Schemas（参数结构）+ Datasets（枚举值）+ Functions（handler 逻辑）+ Components（UI 渲染）
- **Ontology** = Object Types（对象类型）+ Object Relations（对象关系），Object Types 通过 schemaId FK 引用 Schema 定义属性结构
- **System Prompt** 是所有概念的汇聚点，通过 LiquidJS 模板引用一切
- **Skills** 是懒加载的——只有摘要注入系统提示词，完整内容按需通过内置工具获取
- **变量优先级**（低→高）：内置变量 → 无依赖的 Datasets → 有依赖的 Datasets（拓扑序） → 运行时额外变量；`tool.*` 为独立命名空间

---

## 打开 Schema 面板

在 Agent 主页面的右上角菜单中，点击 **Schemas** 即可打开管理面板。

面板采用左右分栏布局：
- **左侧**：Schema 列表 + 新建按钮
- **右侧**：选中 Schema 的详情编辑（名称、描述、JSON 编辑器）

---

## 创建 Schema

1. 点击左侧列表底部的 **New Schema** 按钮
2. 在弹窗中填写：
   - **Key**（必填）：唯一标识符，snake_case 格式。例如 `loan_application_input`
   - **Name**（可选）：显示名称，默认从 Key 自动生成
3. 点击 **Create**

---

## 编辑 Schema

Schema 的 `parameters` 使用 **JSON 编辑器** 直接编辑标准 JSON Schema 7。编辑器基于 Monaco Editor，支持语法高亮和实时校验。

详情页有两个子标签：
- **Edit**：JSON 编辑器，直接编辑 `parameters` JSON
- **Preview**：模板渲染预览，将当前 JSON Schema 通过 LiquidJS 模板引擎渲染后，以只读 JSON 编辑器展示结果。可用数据仅限**数据集变量**（扁平命名空间，拓扑排序解析），不包含内置变量、tool 命名空间、ontology 等

JSON 解析失败时（用户还在打字），表单值不会更新，避免中间状态丢失。

### AI 辅助编辑

JSON Schema 标签行提供 **AI 编辑** 按钮（SparklesIcon），点击打开 AI 辅助编辑 Dialog：

- **左侧**：Diff 编辑器，对比原始 JSON Schema 和 AI 修改后的结果
- **右侧**：AI 聊天，用自然语言描述需求（如"添加一个 email 字段"、"把 age 改为可选"）

AI 支持两种操作：
- **整体替换**：完全重写 JSON Schema
- **局部编辑**：精确匹配并替换指定片段

确认修改后点击 **Apply** 应用到表单。

### 帮助指南

JSON Schema 标签行的问号图标（CircleHelpIcon）打开 **Guide Dialog**，包含 JSON Schema 编辑的快速参考文档。

---

## 存储格式

Schema 的 `parameters` 列直接存储标准 JSON Schema 7 对象：

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string", "description": "借款人姓名" },
    "age": { "type": "integer", "minimum": 18, "description": "年龄" },
    "state": { "type": "string", "enum": ["CA", "NY", "TX"] }
  },
  "required": ["name", "age"]
}
```

关键特点：
- 属性名即 JSON key（`properties` 对象的 key）
- 必填属性在父级 `required` 数组中列出
- 扩展字段使用 `x-` 前缀（如联合类型的 `x-discriminator`）
- Schema 间引用使用标准 `$ref` + `$defs`
- 枚举值支持 LiquidJS 模板 + filter 引用数据集

---

## 类型系统

每个属性的类型由 JSON Schema 结构推断，UI 中使用 `DisplayType` 显示：

### 九种显示类型

| DisplayType | JSON Schema 表示 | Zod 映射 |
|-------------|-----------------|---------|
| `string` | `{ "type": "string" }` | `z.string()` |
| `integer` | `{ "type": "integer" }` | `z.number().int()` |
| `number` | `{ "type": "number" }` | `z.number()` |
| `boolean` | `{ "type": "boolean" }` | `z.boolean()` |
| `object` | `{ "type": "object", "properties": {...} }` | `z.object({...})` |
| `array` | `{ "type": "array", "items": {...} }` | `z.array(...)` / `z.tuple([...])` |
| `union` | `{ "oneOf": [...] }` 或 `{ "anyOf": [...] }` | `z.discriminatedUnion()` / `z.union()` |
| `null` | `{ "type": "null" }` | `z.null()` |
| `const` | `{ "const": value }` | `z.literal(value)` |

> **枚举（Enum）** 不是独立类型，而是 `string` 类型的约束。在 JSON Schema 中定义为 `{ "type": "string", "enum": [...] }`，Zod 映射为 `z.enum([...])`。

### 属性公共字段

每个属性（不论类型）支持以下 JSON Schema 字段：

| 字段 | 说明 |
|------|------|
| `description` | 属性描述，LLM 会看到 |
| `default` | 默认值，缺失时自动填充（Zod `.default()`） |

> **注意**：`description` 非常重要——它会传递给 LLM，直接影响 LLM 对参数语义的理解。

### 必填与可选

属性的必填/可选由父级 `required` 数组控制：
- 属性名在 `required` 数组中 → 必填（Zod 不加修饰符）
- 属性名不在 `required` 数组中 → 可选（Zod `.optional()`）

### default 行为

当属性不在 `required` 中且设置了 `default` 时：
- Zod 使用 `.default(value)` — 字段缺失时自动填充默认值
- JSON Schema 输出 `"default": value` — LLM 可以看到默认值提示

当属性不在 `required` 中且没有 `default` 时：
- Zod 使用 `.optional()` — 字段缺失时值为 `undefined`

### nullable（可空）

可空使用 JSON Schema 的 `anyOf` 模式表示：

```json
{
  "anyOf": [
    { "type": "string" },
    { "type": "null" }
  ]
}
```

- Zod：`.nullable()` — 接受原类型值和 `null`

`nullable` 可以和 `required`/`optional` 组合：
- 在 `required` 中 + nullable → 字段必须存在，值可以是 `T` 或 `null`
- 不在 `required` 中 + nullable → 字段可以缺失（`undefined`），也可以是 `null` 或 `T`

**与 `null` 类型的区别**：`{ "type": "null" }` 表示该字段只能是 `null`，而 nullable 模式表示该字段可以是原类型或 `null`。

---

## 各类型详解与约束

### string

基础字符串类型，支持以下约束：

| 约束 | Zod | JSON Schema | 说明 |
|------|-----|-------------|------|
| `minLength` | `.min(n)` | `"minLength": n` | 最小长度 |
| `maxLength` | `.max(n)` | `"maxLength": n` | 最大长度 |
| `pattern` | `.regex(r)` | `"pattern": "..."` | 正则表达式 |
| `format` | 见下方 | `"format": "..."` | 格式校验 |

**支持的 format 值**：

| format | 示例 | Zod 方法 |
|--------|------|---------|
| `email` | `user@example.com` | `.email()` |
| `url` | `https://example.com` | `.url()` |
| `uuid` | `550e8400-e29b-41d4-a716-446655440000` | `.uuid()` |
| `date` | `2026-02-19` | `.date()` |
| `date-time` | `2026-02-19T10:30:00Z` | `.datetime()` |
| `time` | `14:30:00` | `.time()` |
| `ipv4` | `192.168.1.1` | `.ipv4()` |
| `ipv6` | `::1` | `.ipv6()` |

### integer

整数类型，是 JSON Schema 的独立类型（不是 number 的子选项）。

| 约束 | Zod | JSON Schema | 说明 |
|------|-----|-------------|------|
| `minimum` | `.min(n)` | `"minimum": n` | 最小值（含） |
| `maximum` | `.max(n)` | `"maximum": n` | 最大值（含） |
| `exclusiveMinimum` | `.gt(n)` | `"exclusiveMinimum": n` | 最小值（不含） |
| `exclusiveMaximum` | `.lt(n)` | `"exclusiveMaximum": n` | 最大值（不含） |
| `multipleOf` | `.multipleOf(n)` | `"multipleOf": n` | 必须是 n 的倍数 |

### number

数值类型，允许浮点数。约束与 integer 相同。

### boolean

布尔类型，无额外约束。接受 `true` 或 `false`。

### null

空值类型，表示"值存在但为空"。

- JSON Schema：`{ "type": "null" }`
- Zod：`z.null()`
- 无额外约束，仅接受 `null`

### const

固定值类型，限制参数必须等于指定的常量值。

- JSON Schema：`{ "const": "v2" }`
- Zod：`z.literal("v2")`

支持字符串、数字和布尔常量值。

### string 的枚举约束（enum）

枚举是 `string` 类型的约束（而非独立类型），限制参数值必须是预定义列表中的一个。

JSON Schema 表示：`{ "type": "string", "enum": ["CA", "NY", "TX"] }`

**两种枚举值来源**：

1. **模板 + filter**（推荐）：在 `enum` 数组中使用 LiquidJS 模板 + `json` filter 引用数据集，显式声明展开意图
2. **内联值**：直接在 `enum` 数组中定义静态值

**模板语法**：

```json
{
  "type": "string",
  "enum": ["{{ us_states | json }}"]
}
```

运行时，`{{ us_states | json }}` 会渲染为 JSON 数组字符串，系统解析后展开为枚举值。可以混合使用模板和静态值：

```json
{
  "type": "string",
  "enum": ["{{ us_states | json }}", "other"]
}
```

**常用 filter 组合**：

| 写法 | 适用场景 | 示例 |
|------|---------|------|
| `{{ arr \| json }}` | 数组直接展开 | `["CA","TX"]` → enum `["CA","TX"]` |
| `{{ obj \| keys \| json }}` | 取对象 keys | `{"CA":"California"}` → enum `["CA"]` |
| `{{ obj \| values \| json }}` | 取对象 values | `{"CA":"California"}` → enum `["California"]` |
| `{{ arr \| map: "field" \| json }}` | 取数组对象的某字段 | `[{name:"A"}]` → enum `["A"]` |

**展开规则**：渲染结果为合法 JSON 数组字符串（`[` 开头）时，解析后 spread 为多个枚举值；否则作为字面量字符串使用。不含 `{{ }}` 的元素保留原值。

**无枚举值时的行为**：当模板变量无法解析或枚举所有来源都无法解析出值时，退化为 `z.string()`。

> **编辑器支持**：JSON 编辑器中输入 `{{` 会自动补全可用的数据集变量名。详见 [模板引擎文档](template-engine.md) 的 Filter 章节。

### object

嵌套对象类型，有三种定义方式：

**方式一：内联 properties**

```json
{
  "type": "object",
  "properties": {
    "street": { "type": "string" },
    "city": { "type": "string" },
    "zip": { "type": "string", "pattern": "^\\d{5}$" }
  },
  "required": ["street", "city"]
}
```

**方式二：引用 $ref**

通过 `$ref` 引用另一个 Schema，实现复用：

```json
{
  "$ref": "#/$defs/address_fields"
}
```

运行时会从 `defsMap`（agent 所有 schema 的 key → parameters 映射）中查找该 Schema 的 parameters，展开为嵌套对象。支持递归自引用（通过 `z.lazy()` 实现）。

`$ref` 格式为 `#/$defs/{schema_key}`，使用人类可读的 schema key（snake_case），而非 UUID。

**方式三：Map/Record（additionalProperties）**

```json
{
  "type": "object",
  "additionalProperties": { "type": "string" }
}
```

对应 Zod 的 `z.record(z.string(), z.string())`。可以与固定 properties 组合使用（`.catchall()`）。

**无 properties、无引用、无 additionalProperties 时**：退化为 `z.unknown()`。

### Schema 组合（allOf + $ref）

通过 `allOf` + `$ref` 组合多个 Schema 的属性，实现继承和复用：

```json
{
  "allOf": [
    { "$ref": "#/$defs/contact_info" },
    { "$ref": "#/$defs/address_fields" }
  ],
  "type": "object",
  "properties": {
    "ssn_last4": { "type": "string" }
  }
}
```

运行时将所有 `$ref` 引用的 Schema properties 合并为一个对象。合并规则：
- 按 `allOf` 数组顺序遍历，后者覆盖前者
- 自身的 `properties` 优先级最高（覆盖所有 `$ref` 来源）
- `required` 数组取并集

### array

数组类型，支持两种模式：

**模式一：同类型元素（items，默认）**

```json
{
  "type": "array",
  "items": { "type": "string" },
  "minItems": 1,
  "maxItems": 10,
  "uniqueItems": true
}
```

| 约束 | Zod | 说明 |
|------|-----|------|
| `items` | 递归构建 | 元素类型定义 |
| `minItems` | `.min(n)` | 最少元素数 |
| `maxItems` | `.max(n)` | 最多元素数 |
| `uniqueItems` | `.refine()` | 元素唯一 |

**模式二：固定位置（tuple / prefixItems）**

当存在 `prefixItems` 时自动识别为 tuple 模式：

```json
{
  "type": "array",
  "prefixItems": [
    { "type": "number" },
    { "type": "number" }
  ]
}
```

- Zod：`z.tuple([z.number(), z.number()])`

### union

联合类型，表达"值是 A 或 B 其中之一"的语义。

**oneOf 模式**（默认）：

```json
{
  "oneOf": [
    { "type": "object", "properties": { "content": { "type": "string" } }, "required": ["content"] },
    { "type": "object", "properties": { "url": { "type": "string" } }, "required": ["url"] }
  ],
  "x-unionMode": "oneOf",
  "x-discriminator": "kind",
  "x-discriminatorValues": ["text", "image"]
}
```

**anyOf 模式**：

```json
{
  "anyOf": [
    { "type": "object", "properties": { "name": { "type": "string" } }, "required": ["name"] },
    { "type": "object", "properties": { "count": { "type": "number" } }, "required": ["count"] }
  ],
  "x-unionMode": "anyOf"
}
```

**扩展字段**：

| 字段 | 说明 |
|------|------|
| `x-unionMode` | `"oneOf"` 或 `"anyOf"`，默认 `"oneOf"` |
| `x-discriminator` | 判别字段名（仅 oneOf 模式） |
| `x-discriminatorValues` | 每个变体的判别字段值（与 oneOf/anyOf 数组一一对应） |

每个变体支持任意类型（原始类型和对象类型均可）。

**oneOf + discriminator 时**：使用 `z.discriminatedUnion()`。系统自动为每个对象变体注入 `z.literal()` 判别字段。

**不足 2 个变体时**：退化为 `z.unknown()`。

---

## Schema 引用（$ref）

Schema 之间通过标准 JSON Schema `$ref` 机制互相引用，使用 `#/$defs/{schema_key}` 格式。

### $ref 约定

- 格式：`#/$defs/{schema_key}`（使用 Schema 的 `key` 字段，人类可读的 snake_case）
- `$defs` **不存储**在每个 Schema 中，而是在运行时（build time）由系统注入
- 系统加载 agent 所有 schemas，构建 `defsMap: { [schema.key]: schema.parameters }`
- 遇到 `$ref: "#/$defs/key"` → 从 defsMap 查找 → 递归构建 Zod
- 循环引用 → 自动使用 `z.lazy()` 避免无限递归

### 使用示例

假设有两个 Schema：

**Schema: address_fields** (key: `address_fields`)
```json
{
  "type": "object",
  "properties": {
    "street": { "type": "string" },
    "city": { "type": "string" },
    "state": { "type": "string" }
  },
  "required": ["street", "city"]
}
```

**Schema: borrower_profile** (key: `borrower_profile`)
```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "address": { "$ref": "#/$defs/address_fields" }
  },
  "required": ["name", "address"]
}
```

运行时，`$ref` 会被解析为 `address_fields` Schema 的完整定义。

### 组合多个 Schema

使用 `allOf` + `$ref` 实现多 Schema 组合：

```json
{
  "allOf": [
    { "$ref": "#/$defs/contact_info" },
    { "$ref": "#/$defs/address_fields" }
  ],
  "type": "object",
  "properties": {
    "ssn_last4": { "type": "string" }
  },
  "required": ["ssn_last4"]
}
```

---

## Schema 的引用方

Schema 被以下实体引用：

| 实体 | 引用方式 | 用途 |
|------|---------|------|
| **Tool（工具）** | `parametersSchema` (inline JSONB) | 工具的输入参数定义 |
| **Tool（工具）** | `returnParametersSchema` (inline JSONB) | 工具的返回值结构定义 |
| **Function（函数）** | `parametersSchema` (inline JSONB) | 函数的输入参数定义 |
| **Function（函数）** | `returnParametersSchema` (inline JSONB) | 函数的返回值结构定义 |
| **Component（组件）** | `inputSchema` / `outputSchema` (inline JSONB) | 组件的输入/输出数据结构 |
| **Object Type（对象类型）** | `schemaId` (FK) | 对象的属性结构定义 |
| **Schema 参数内部** | `$ref` | 引用另一个 Schema |

工具、函数、组件使用**内联 JSONB** 存储 Schema 定义：
- 工具/函数：可选，设为 `null` 表示不设置，或直接存储完整 JSON Schema 对象
- 组件：必填，始终存储完整 JSON Schema 对象

共享 Schema 表仍保留，主要供 Object Type 通过 FK 引用，以及作为 `$ref` 解析的 defsMap 数据源。

---

## 双层架构

Schema 在系统中有两条转换路径：

```
┌──────────────────────────────────────────────────────────────────────┐
│  Layer 1: JSON Schema 7（数据库）                                     │
│  存储在 schemas.parameters (JSONB) 中                                │
│  标准 JSON Schema 7 格式，直接可用                                    │
└──────┬───────────────────────────────────┬───────────────────────────┘
       │                                   │
  buildInputSchema()                  buildZodCode()
       │                                   │
       ▼                                   ▼
┌────────────────────────────────┐  ┌────────────────────────────┐
│ Zod Schema（运行时）            │  │ TypeScript 代码（导出）      │
│ 运行时参数校验                  │  │ 人类可读的 Zod 代码         │
│ AI SDK 自动转为                 │  │ 用于开发者集成              │
│ JSON Schema 发给 LLM           │  │                            │
└────────────────────────────────┘  └────────────────────────────┘
```

### 路径一：Zod（运行时校验 + AI SDK）

代码位于 `web/src/lib/tools/schema-builder.ts` 的 `buildInputSchema()`。入参为 `JsonSchema7`，返回 `z.ZodObject`。

关键行为：
- 不在 `required` 中 + `default` → `.default(value)`
- 不在 `required` 中 + 无 default → `.optional()`
- `description` → `.describe(text)`
- `enum` 值从模板 + filter `"{{ dataset_key | json }}"` / 内联 `enum` 解析
- `$ref` 从 `options.defsMap` 解析，支持递归自引用（`z.lazy()`）
- `allOf` + `$ref` → 合并 properties/required → 构建 `z.object`
- `additionalProperties` → `z.record()` 或 `.catchall()`
- `oneOf` / `anyOf` + `x-discriminator` → `z.discriminatedUnion()` 或 `z.union()`
- `anyOf: [T, {type:"null"}]` → `.nullable()`
- `uniqueItems` → `.refine()`（Zod 运行时生效，但 AI SDK 转 JSON Schema 时丢失）

### 路径二：TypeScript Zod Code（开发者导出）

代码位于 `web/src/lib/tools/zod-code-builder.ts` 的 `buildZodCode()`。入参为 `JsonSchema7`，返回 TypeScript 代码字符串。

### 模板渲染预览

Schema 详情页有 **Edit / Preview** 两个子标签：

- **Edit**：JSON 编辑器，直接编辑 `parameters`
- **Preview**：模板渲染预览，将当前 JSON Schema 文本通过 LiquidJS 渲染后，以只读 JsonEditor 展示结果

切换到 Preview 时，系统将当前 JSON Schema 文本 POST 到 `/api/schema/template/preview`，服务端仅使用**数据集变量**（通过 `getResolvedDatasets` 获取的扁平命名空间）进行渲染。不注入内置变量（date/time 等）、tool 命名空间、ontology 等——Schema 模板只能引用数据集。

渲染结果以只读 JSON 编辑器展示（高度 400px），JSON 解析失败时在编辑器上方显示错误提示。

---

## 运行时流程

当用户发送消息、LLM 决定调用工具时，Schema 的完整生命周期如下：

```
1. 加载工具定义
   └── 从 DB 读取 tool.parametersSchema (inline JSONB)

2. 解析 Schema（gatherTemplateData）
   └── 加载 agent 所有共享 schemas
   └── 构建 defsMap: key → parameters（$ref 解析）
   └── 加载 resolvedVars（数据集变量，用于模板枚举展开）

3. 构建工具定义负载
   └── 直接读取 tool.parametersSchema（内联 JSONB）
   └── 如果是 $ref，从 defsMap 解析为完整 JsonSchema7
   └── 同理处理 returnParametersSchema

4. 构建 Zod Schema
   └── buildInputSchema(parameters, resolvedVars, { defsMap })
   └── 返回 z.object({...})

5. 注册为 AI SDK Tool
   └── tool({ description, inputSchema: zodSchema, execute })
   └── AI SDK 自动将 Zod 转为 JSON Schema 发给 LLM

6. LLM 生成工具调用
   └── LLM 根据 JSON Schema 生成参数 JSON
   └── AI SDK 用 Zod Schema 校验参数
   └── 校验通过 → 执行 handler
   └── 校验失败 → 报错

7. 输出验证（可选）
   └── 如果配置了 returnParametersSchema
   └── 用同样的流程构建输出 Zod Schema
   └── 验证失败时注入 _outputValidationWarning（不阻断）
```

---

## x- 扩展字段

Archon 使用以下 `x-` 前缀扩展字段：

| 字段 | 说明 |
|------|------|
| `x-discriminator` | 联合类型的判别字段名 |
| `x-discriminatorValues` | 联合类型每个变体的判别值 |
| `x-unionMode` | 联合类型匹配规则：`"oneOf"` 或 `"anyOf"` |

> **注意**：枚举值引用数据集使用模板 + filter `"enum": ["{{ dataset_key | json }}"]`，不再使用 `x-enumDatasetId`。Schema 间引用全部使用标准 `$ref` + 人类可读的 key。

---

## Examples（用例示范）

Schema 的测试用例可以标记为 **Example**，在 Examples 标签页中集中展示，用于向 FDA 或团队成员演示 Schema 的典型输入。

### 标记为 Example

1. 打开 Schema 详情页 → **Test Cases** 标签
2. 展开任意测试用例，打开 **Show as Example** 开关
3. 该用例会立即出现在 **Examples** 标签页中

### Examples 标签页

位于 Edit 和 Playground 之间。展示所有标记为 Example 的测试用例。

### Playground 保存

Playground 底部新增 **Save** 按钮，可将当前输入保存为测试用例。

---

## 最佳实践

### 命名规范

- Schema key 使用 snake_case：`borrower_info`、`loan_params`
- 属性名使用 snake_case：`annual_income`、`property_type`
- 保持属性名与业务术语一致，LLM 更容易理解

### 写好 description

`description` 是 LLM 理解参数语义的唯一线索。好的 description 应该：

- 说明参数的业务含义，而不是技术类型
- 包含示例值（如有必要）
- 说明特殊规则或约束

### 善用 $ref 组合

将通用结构抽取为独立 Schema，通过 `$ref` + `allOf` 复用：

```
Schema: address_fields (key: address_fields)
  → { street, city, state, zip }

Schema: contact_info (key: contact_info)
  → { name, email, phone }

Schema: borrower_profile (key: borrower_profile)
  → allOf: [$ref address_fields, $ref contact_info]
  → own properties: { ssn_last4, date_of_birth }
```

### 优先用模板字符串引用数据集

枚举值应该用模板 + filter `"enum": ["{{ dataset_key | json }}"]` 引用数据集，而不是内联在 `enum` 数组中。好处：

- 枚举值集中管理，修改数据集即全局生效
- 数据集可以在模板中复用
- 保持参数定义干净
- 编辑器支持自动补全数据集变量名

### 保持 Schema 粒度合理

- 一个 Schema 对应一个业务概念（如"地址"、"借款人信息"）
- 避免把所有参数都堆在一个巨型 Schema 里
- 但也不要过度拆分——每个 Schema 至少应该有 2-3 个属性
