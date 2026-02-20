# Schema 使用指南

Schema 是系统的可复用参数定义层。工具（Tool）、函数（Function）、对象类型（Object Type）共享同一套 Schema 机制来描述数据结构。Schema 定义存储在数据库中（JSONB），运行时转换为 Zod 校验 + JSON Schema 7（发给 LLM），形成三层架构。

---

## 打开 Schema 面板

在 Agent 主页面的右上角菜单中，点击 **Schemas** 即可打开管理面板。

面板采用左右分栏布局：
- **左侧**：Schema 列表 + 新建按钮
- **右侧**：选中 Schema 的详情编辑（名称、描述、参数列表、包含关系）

---

## 创建 Schema

1. 点击左侧列表底部的 **New Schema** 按钮
2. 在弹窗中填写：
   - **Key**（必填）：唯一标识符，snake_case 格式。例如 `loan_application_input`
   - **Name**（可选）：显示名称，默认从 Key 自动生成
3. 点击 **Create**

---

## 类型系统

每个参数（SchemaProperty）有一个 `type` 字段，决定其数据类型和可用约束。

### 七种基础类型

| 类型 | 说明 | Zod 映射 | JSON Schema 映射 |
|------|------|---------|-----------------|
| `string` | 字符串 | `z.string()` | `{"type":"string"}` |
| `number` | 数值（含浮点） | `z.number()` | `{"type":"number"}` |
| `boolean` | 布尔值 | `z.boolean()` | `{"type":"boolean"}` |
| `enum` | 枚举（固定可选值） | `z.enum([...])` | `{"type":"string","enum":[...]}` |
| `object` | 嵌套对象 | `z.object({...})` | `{"type":"object","properties":{...}}` |
| `array` | 数组 | `z.array(...)` | `{"type":"array","items":{...}}` |
| `union` | 联合类型（A 或 B） | `z.discriminatedUnion()` / `z.union()` | `{"oneOf":[...]}` |

### 参数公共字段

每个参数（不论类型）都有以下基础字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 参数名，作为 JSON key |
| `type` | SchemaPropertyType | 是 | 数据类型 |
| `description` | string | 是 | 参数描述，LLM 会看到 |
| `required` | boolean | 是 | 是否必填 |
| `defaultValue` | unknown | 否 | 默认值，缺失时自动填充（Zod `.default()`） |

> **注意**：`description` 非常重要——它会通过 JSON Schema 的 `description` 字段传递给 LLM，直接影响 LLM 对参数语义的理解。

### defaultValue 行为

当 `required: false` 且设置了 `defaultValue` 时：
- Zod 使用 `.default(value)` — 字段缺失时自动填充默认值，结果始终有值
- JSON Schema 输出 `"default": value` — LLM 可以看到默认值提示

当 `required: false` 且没有 `defaultValue` 时：
- Zod 使用 `.optional()` — 字段缺失时值为 `undefined`

---

## 各类型详解与约束

### string

基础字符串类型，支持以下约束：

| 约束 | 类型 | Zod | JSON Schema | 说明 |
|------|------|-----|-------------|------|
| `minLength` | number | `.min(n)` | `"minLength":n` | 最小长度 |
| `maxLength` | number | `.max(n)` | `"maxLength":n` | 最大长度 |
| `pattern` | string | `.regex(r)` | `"pattern":"..."` | 正则表达式 |
| `format` | string | 见下方 | `"format":"..."` | 格式校验 |

**支持的 format 值**：

| format | 示例 | Zod 方法 |
|--------|------|---------|
| `email` | `user@example.com` | `.email()` |
| `url` | `https://example.com` | `.url()` |
| `uuid` | `550e8400-e29b-41d4-a716-446655440000` | `.uuid()` |
| `date` | `2026-02-19` | `.date()` |
| `date-time` | `2026-02-19T10:30:00Z` | `.datetime()` |

### number

数值类型，默认允许浮点数。

| 约束 | 类型 | Zod | JSON Schema | 说明 |
|------|------|-----|-------------|------|
| `integer` | boolean | `.int()` | `"type":"integer"` | 限制为整数 |
| `minimum` | number | `.min(n)` | `"minimum":n` | 最小值（含） |
| `maximum` | number | `.max(n)` | `"maximum":n` | 最大值（含） |
| `exclusiveMinimum` | number | `.gt(n)` | `"exclusiveMinimum":n` | 最小值（不含） |
| `exclusiveMaximum` | number | `.lt(n)` | `"exclusiveMaximum":n` | 最大值（不含） |
| `multipleOf` | number | `.multipleOf(n)` | `"multipleOf":n` | 必须是 n 的倍数 |

> 当 `integer: true` 时，JSON Schema 的 type 会从 `"number"` 变为 `"integer"`。

### boolean

布尔类型，无额外约束。接受 `true` 或 `false`。

### enum

枚举类型，限制参数值必须是预定义列表中的一个。

**两种枚举值来源**（按优先级排列）：

1. **enumDatasetId**（推荐）：引用一个数据集（Dataset）的 UUID，运行时从数据集解析枚举值
2. **enum**（内联）：直接在参数定义中写死枚举值数组

```
解析优先级：enumDatasetId > inline enum
```

**数据集解析规则**：

| 数据集类型 | 解析方式 | 示例 |
|-----------|---------|------|
| 数组 | 直接使用 | `["CA","NY","TX"]` → enum `["CA","NY","TX"]` |
| 对象（值为字符串） | 取 values | `{"w2":"W2 Income","se":"Self Employed"}` → enum `["W2 Income","Self Employed"]` |
| 对象（值为非字符串） | 取 keys | `{"a":1,"b":2}` → enum `["a","b"]` |

**无枚举值时的行为**：当 `type: "enum"` 但所有来源都无法解析出枚举值时，退化为 `z.string()`（会打印警告日志）。

### object

嵌套对象类型，有三种定义方式：

**方式一：内联 properties**

直接在参数的 `properties` 字段中定义子参数列表：

```
参数: address (type: object)
  └── properties:
      ├── street (type: string, required)
      ├── city (type: string, required)
      └── zip (type: string, pattern: "^\d{5}$")
```

**方式二：引用 schemaId**

通过 `schemaId` 引用另一个 Schema 的参数定义，实现复用：

```
参数: billing_address (type: object, schemaId: "<address-schema-uuid>")
```

运行时会从 schemaMap 中查找该 Schema 的参数列表，展开为嵌套对象。支持递归自引用（通过 `z.lazy()` 实现），可以表达树形结构。

**方式三：Map/Record（additionalProperties）**

通过 `additionalProperties` 字段定义动态 key 的值类型，对应 JSON Schema 的 `additionalProperties` 和 Zod 的 `z.record()`：

```
参数: metadata (type: object, additionalProperties: {type: string})
→ z.record(z.string(), z.string())
→ 接受 {"key1": "val1", "key2": "val2"} 等任意 string→string 映射
```

可以与固定 properties 组合使用，此时固定字段用 `z.object()` 定义，动态字段用 `.catchall()` 允许：

```
参数: config (type: object)
  properties: [name (required), version (required)]
  additionalProperties: {type: string}
→ z.object({ name: z.string(), version: z.string() }).catchall(z.string())
```

**无 properties、无 schemaId、无 additionalProperties 时**：退化为 `z.unknown()`，接受任意数据。

### array

数组类型，通过 `items` 字段定义元素的类型。

| 约束 | 类型 | Zod | JSON Schema | 说明 |
|------|------|-----|-------------|------|
| `items` | SchemaProperty | 递归构建 | `"items":{...}` | 元素类型定义 |
| `minItems` | number | `.min(n)` | `"minItems":n` | 最少元素数 |
| `maxItems` | number | `.max(n)` | `"maxItems":n` | 最多元素数 |
| `uniqueItems` | boolean | `.refine()` | `"uniqueItems":true` | 元素唯一 |

> `uniqueItems` 在 Zod 层通过 `.refine()` 实现运行时校验，在 JSON Schema 层直接输出 `"uniqueItems": true`。但 `.refine()` 不会被 AI SDK 的 `zod-to-json-schema` 转换器识别——如果走 Zod→JSON Schema 隐式路径，LLM 看不到此约束。走 `buildJsonSchema()` 显式路径则正确输出。

**无 items 时**：元素类型为 `z.unknown()`，接受任意类型的元素。

**嵌套示例**：

```
参数: tags (type: array)
  └── items: (type: string, minLength: 1)

参数: contacts (type: array, minItems: 1)
  └── items: (type: object)
      └── properties:
          ├── name (type: string, required)
          └── phone (type: string)
```

### union

联合类型，表达"值是 A 或 B 其中之一"的语义。

**核心字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `discriminator` | string | 判别字段名（可选，有则用 discriminated union） |
| `variants` | SchemaProperty[][] | 每个变体的参数列表（至少 2 个） |

**有 discriminator 时**：使用 `z.discriminatedUnion()`——每个变体必须有一个相同名称的 literal 字段作为判别：

```
参数: payment (type: union, discriminator: "method")
  variants:
    ├── [method: "card", card_number: string, expiry: string]
    └── [method: "bank", account_number: string, routing: string]
```

**无 discriminator 时**：使用 `z.union()`——Zod 按顺序尝试匹配。

**不足 2 个变体时**：退化为 `z.unknown()`（打印警告）。

---

## Schema 组合（Includes）

Schema 支持通过 **包含（Include）** 机制组合多个 Schema 的参数，实现继承和复用。

### 工作原理

一个 Schema 可以包含多个其他 Schema。运行时，系统递归解析所有被包含的 Schema，将参数合并到一起。

```
Schema: loan_application
  includes: [base_borrower_info, income_details]
  own parameters: [loan_amount, loan_purpose]

解析结果 = base_borrower_info 的参数
         + income_details 的参数
         + loan_application 自身参数
```

### 合并优先级

当同名参数出现在多个来源时，按以下优先级（高覆盖低）：

1. **自身参数**（最高）
2. **后面的 include**
3. **前面的 include**（最低）

例如，自身和 include 都定义了 `name` 参数，以自身定义为准。

### 循环检测

系统自动检测循环包含（A includes B, B includes A）。UI 在选择 include 时会过滤掉会导致循环的选项。

### 合并预览

编辑 Schema 时，如果配置了 includes，面板底部会显示**合并预览**，展示解析后的完整参数列表及每个参数的来源标签（own / 来自哪个 Schema）。

---

## Schema 的引用方

Schema 被以下实体引用：

| 实体 | 引用字段 | 用途 |
|------|---------|------|
| **Tool（工具）** | `parametersSchemaId` | 工具的输入参数定义 |
| **Tool（工具）** | `returnParametersSchemaId` | 工具的返回值结构定义 |
| **Function（函数）** | `parametersSchemaId` | 函数的输入参数定义 |
| **Function（函数）** | `returnParametersSchemaId` | 函数的返回值结构定义 |
| **Object Type（对象类型）** | `schemaId` | 对象的属性结构定义 |
| **Object 类型参数** | `schemaId` | 嵌套对象引用已有 Schema |

删除 Schema 时，引用方的对应字段会被设为 `null`（`onDelete: "set null"`）。

---

## 三层架构

Schema 在系统中有两条转换路径：

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: SchemaProperty[]（数据库）                  │
│  存储在 schemas.parameters (JSONB) 中                │
│  人类可读、可编辑的参数定义                             │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
    buildInputSchema()         buildJsonSchema()
               │                      │
               ▼                      ▼
┌──────────────────────┐  ┌──────────────────────────┐
│  Zod Schema（运行时）  │  │  JSON Schema 7（显式生成） │
│  运行时参数校验        │  │  直接输出标准 JSON Schema  │
│  AI SDK 自动转为       │  │  包含 uniqueItems 等      │
│  JSON Schema 发给 LLM  │  │  所有字段完整保留         │
└──────────────────────┘  └──────────────────────────┘
```

### 路径一：Zod（运行时校验 + AI SDK）

代码位于 `web/src/lib/tools/schema-builder.ts` 的 `buildInputSchema()`。入参为 `SchemaProperty[]`，返回 `z.ZodObject`。

关键行为：
- `required: false` + `defaultValue` → `.default(value)`
- `required: false` 无 defaultValue → `.optional()`
- `description` → `.describe(text)`
- enum 值从 `datasetsById` / 内联 `enum` 解析
- object 的 `schemaId` 从 `schemaMap` 解析，支持递归自引用（`z.lazy()`）
- object 的 `additionalProperties` → `z.record()` 或 `.catchall()`
- union 的 `discriminator` + `variants` → `z.discriminatedUnion()` 或 `z.union()`
- `uniqueItems` → `.refine()`（Zod 运行时生效，但 AI SDK 转 JSON Schema 时丢失）

AI SDK 的 `tool()` 内部用 `zod-to-json-schema` 将 Zod 自动转为 JSON Schema。大部分映射正确，已知丢失：`.refine()` 类的自定义校验。

### 路径二：JSON Schema 7（显式生成）

代码位于同一文件的 `buildJsonSchema()`。直接从 `SchemaProperty[]` 生成标准 JSON Schema 7 对象，不经过 Zod。

签名：`buildJsonSchema(parameters, options?)`，可选的 `BuildSchemaOptions` 与 Zod 路径共用。

所有字段完整保留：`uniqueItems`、`default`、`format`、`pattern` 等均直接输出对应的 JSON Schema 关键字。适用于 API 文档导出、前端预览、第三方对接等场景。

**对齐清单**（SchemaProperty → JSON Schema 7 映射）：

| SchemaProperty 特性 | JSON Schema 输出 |
|---------------------|-----------------|
| `schemaId` 引用 | `$ref: "#/$defs/<schemaId>"` + 顶层 `$defs` |
| 递归自引用 | `$ref`（相同 key，不无限展开） |
| `additionalProperties` | `"additionalProperties": {...}` |
| `union` + `variants` | `"oneOf": [...]` |
| `union` + `discriminator` | `"discriminator": { "propertyName": "..." }` |
| `enumDatasetId` | 从 `options.datasetsById` 解析为 `"enum": [...]` |

### JSON Schema 导出

Schema 详情页提供 **JSON Schema** 预览 tab，可查看当前 Schema 的标准 JSON Schema 7 输出：

- **预览**：实时显示格式化 JSON（基于当前 Schema 参数 + schemaMap 生成）
- **复制**：点击 Copy 按钮复制到剪贴板
- **导出**：点击 Export 按钮下载为 `.json` 文件（文件名为 Schema key）

组件位于 `web/src/components/schemas/schema-json-preview.tsx`。

---

## 运行时流程

当用户发送消息、LLM 决定调用工具时，Schema 的完整生命周期如下：

```
1. 加载工具定义
   └── 从 DB 读取 tool.parametersSchemaId → schemas 表

2. 解析 Schema（gatherTemplateData）
   └── 加载 agent 所有 schemas + schema_includes
   └── 递归解析 includes → 合并参数列表 → 构建 schemaMap
   └── 加载 datasets → 构建 datasetsById

3. 构建工具定义负载
   └── 从 schemaMap 解析 parametersSchemaId → SchemaProperty[]
   └── 从 schemaMap 解析 returnParametersSchemaId → SchemaProperty[]

4. 构建 Zod Schema
   └── buildInputSchema(parameters, resolvedVars, { datasetsById, schemaMap })
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
   └── 如果配置了 returnParametersSchemaId
   └── 用同样的流程构建输出 Zod Schema
   └── 校验 handler 返回值
   └── 验证失败时注入 _outputValidationWarning（不阻断，记录事件）
```

---

## JSON Schema 对齐清单

Archon Schema 的设计目标是尽可能对齐 JSON Schema 标准（Draft 7）。下表列出各特性的支持状态。

**图例**：✅ 已支持　⚠️ 部分支持　❌ 未支持

> **LLM 可见** 列说明：LLM 在 tool calling 时，收到的是 JSON Schema 格式的参数定义。只有出现在 JSON Schema 里的约束，LLM 才能"看到"并遵守。Zod 的 `.refine()` 等运行时校验不会出现在 JSON Schema 中，LLM 看不到。

### 类型

| JSON Schema | Archon | Zod | LLM 可见 | 场景 | 说明 |
|---|---|---|---|---|---|
| `string` | ✅ | `z.string()` | ✅ | 姓名、地址、备注等文本字段 | |
| `number` | ✅ | `z.number()` | ✅ | 金额、价格、评分等数值 | |
| `integer` | ✅ | `.int()` | ✅ | 数量、年龄、楼层等整数 | 通过 `number` + `integer: true` 实现 |
| `boolean` | ✅ | `z.boolean()` | ✅ | 是否同意、是否启用等开关 | |
| `object` | ✅ | `z.object()` | ✅ | 地址、联系人等结构化数据 | 支持嵌套、Schema 引用、additionalProperties |
| `array` | ✅ | `z.array()` | ✅ | 标签列表、联系人列表等集合 | 支持 items 递归 |
| `null` | ❌ | `z.null()` | ✅ | 表示"值存在但为空"，区别于"字段缺失" | |
| `enum`（值约束） | ⚠️ | `z.enum()` | ✅ | 省份、状态、类型等固定选项 | Archon 作为独立 type；JSON Schema 中 enum 是关键字而非 type |
| `const` | ❌ | `z.literal()` | ✅ | 固定值字段，如 `version: "1.0"` 永远不变 | union discriminator 内部隐式使用了 literal，但未暴露为通用能力 |

### 组合关键字

| JSON Schema | Archon | Zod | LLM 可见 | 场景 | 说明 |
|---|---|---|---|---|---|
| `oneOf` | ✅ | `z.discriminatedUnion()` / `z.union()` | ✅ | 支付方式二选一：信用卡 or 银行转账，字段完全不同 | 对应 `union` 类型 |
| `anyOf` | ❌ | `z.union()` | ✅ | 联系方式填至少一种：邮箱 or 手机 or 座机 | |
| `allOf` | ❌ | `z.intersection()` | ✅ | 组合多个定义：基础信息 + 扩展信息合并为一个对象 | Schema Includes 功能类似但不等价 |
| `not` | ❌ | 无直接 API | ✅ | 排除特定值，如"不能是空字符串" | |
| `if` / `then` / `else` | ❌ | 无直接 API | ✅ | 条件字段：如果国家=美国，则必须填州；否则填省 | |

### String 约束

| JSON Schema | Archon | Zod | LLM 可见 | 场景 | 说明 |
|---|---|---|---|---|---|
| `minLength` | ✅ | `.min(n)` | ✅ | 密码至少 8 位、姓名不能为空 | |
| `maxLength` | ✅ | `.max(n)` | ✅ | 备注不超过 500 字、短信不超过 70 字 | |
| `pattern` | ✅ | `.regex(r)` | ✅ | 身份证号、邮编、手机号等固定格式 | |
| `format: email` | ✅ | `.email()` | ✅ | 邮箱地址 | |
| `format: url` | ✅ | `.url()` | ✅ | 网站链接、回调地址 | |
| `format: uuid` | ✅ | `.uuid()` | ✅ | 系统 ID、关联外键 | |
| `format: date` | ✅ | `.date()` | ✅ | 出生日期、入职日期 | |
| `format: date-time` | ✅ | `.datetime()` | ✅ | 带时间的时间戳，如订单创建时间 | |
| `format: time` | ❌ | `.time()` | ✅ | 纯时间，如营业时间 "09:00" | |
| `format: ipv4` / `ipv6` | ❌ | `.ip()` | ✅ | 服务器 IP 地址 | |
| `format: hostname` | ❌ | 无直接 API | ✅ | 域名，如 `api.example.com` | |
| `contentEncoding` | ❌ | 无直接 API | ✅ | Base64 编码的文件内容 | |
| `contentMediaType` | ❌ | 无直接 API | ✅ | 指定内容 MIME 类型，如 `image/png` | |

### Number 约束

| JSON Schema | Archon | Zod | LLM 可见 | 场景 | 说明 |
|---|---|---|---|---|---|
| `minimum` | ✅ | `.min(n)` | ✅ | 年龄 ≥ 0、价格 ≥ 0 | |
| `maximum` | ✅ | `.max(n)` | ✅ | 评分 ≤ 5、折扣率 ≤ 100 | |
| `exclusiveMinimum` | ✅ | `.gt(n)` | ✅ | 利率 > 0（不能为零） | |
| `exclusiveMaximum` | ✅ | `.lt(n)` | ✅ | 概率 < 1（不能等于 1） | |
| `multipleOf` | ✅ | `.multipleOf(n)` | ✅ | 金额精确到分（multipleOf: 0.01）、数量为 12 的倍数 | |

### Object 约束

| JSON Schema | Archon | Zod | LLM 可见 | 场景 | 说明 |
|---|---|---|---|---|---|
| `properties` | ✅ | `z.object({...})` | ✅ | 定义对象的固定字段列表 | |
| `required` | ✅ | 默认必填，`.optional()` 取消 | ✅ | 标记哪些字段必填 | 每个属性单独标记 |
| `additionalProperties` | ✅ | `z.record()` / `.catchall()` | ✅ | 动态标签 `{"color":"red","size":"L"}`，key 不固定 | UI 中的"动态 Key" |
| `minProperties` | ❌ | `.refine()` | ❌ | 至少填 N 个字段 | refine 不转 JSON Schema |
| `maxProperties` | ❌ | `.refine()` | ❌ | 最多填 N 个字段 | refine 不转 JSON Schema |
| `patternProperties` | ❌ | 无直接 API | ✅ | key 名匹配正则的字段统一约束，如 `^S_` 开头的都是 string | |
| `propertyNames` | ❌ | 无直接 API | ✅ | 限制 key 名格式，如只允许小写字母 | |
| `dependencies` / `dependentRequired` | ❌ | `.refine()` | ❌ | 填了信用卡号就必须填有效期 | refine 不转 JSON Schema |

### Array 约束

| JSON Schema | Archon | Zod | LLM 可见 | 场景 | 说明 |
|---|---|---|---|---|---|
| `items`（单一类型） | ✅ | `z.array(schema)` | ✅ | 所有元素同类型，如字符串标签列表 | |
| `minItems` | ✅ | `.min(n)` | ✅ | 至少选 1 个标签、至少上传 1 张图 | |
| `maxItems` | ✅ | `.max(n)` | ✅ | 最多选 5 个兴趣爱好 | |
| `uniqueItems` | ✅ | `.refine()` | ⚠️ | 标签不能重复 | Zod→AI SDK 路径丢失；`buildJsonSchema()` 显式路径正确输出 |
| `prefixItems`（tuple） | ❌ | `z.tuple()` | ✅ | 固定位置固定类型，如 `[经度, 纬度]` | |
| `contains` | ❌ | 无直接 API | ✅ | 数组中至少有一个元素满足某条件 | |

### 通用关键字

| JSON Schema | Archon | Zod | LLM 可见 | 场景 | 说明 |
|---|---|---|---|---|---|
| `description` | ✅ | `.describe(text)` | ✅ | 告诉 LLM 这个参数的含义和填写规则 | |
| `default` | ✅ | `.default(value)` | ✅ | 用户不传时自动填充，如 `country` 默认 "CN" | |
| `title` | ❌ | 无直接 API | ✅ | 给参数起一个人类友好的显示名 | |
| `examples` | ❌ | 无直接 API | ✅ | 给 LLM 看示例值，帮助理解格式 | |
| `readOnly` / `writeOnly` | ❌ | `.readonly()` | ✅ | 标记字段只读（如系统生成的 ID）或只写（如密码） | |
| `$ref` / `$defs` | ⚠️ | `z.lazy()` | ✅ 展开后可见 | 复用定义，如"地址"在多处引用 | 通过 `schemaId` 引用实现，非标准 `$ref` 语法 |

### 小结

常用于 LLM tool calling 的特性（基础类型 + string/number/array/object 约束）覆盖完整。缺失的 `null`、`anyOf`/`allOf`/`not`、`if/then/else`、tuple 等在 LLM 场景中较少用到。

需要注意的关键区别：Zod 的 `.refine()` 只在**运行时校验**生效，LLM 看不到这类约束（如 `uniqueItems`、`minProperties`、`dependencies`）。如果需要 LLM 也看到，必须走 `buildJsonSchema()` 显式路径，或在 `description` 中用自然语言描述约束。

---

## 已知问题

- `enum` 作为独立 type 与 JSON Schema 标准存在语义差异：JSON Schema 中 `enum` 不是 type 而是 `string` 的值约束。当前功能上无影响，但做 JSON Schema 导入时需要映射。

---

## 最佳实践

### 命名规范

- Schema key 使用 snake_case：`borrower_info`、`loan_params`
- 参数 name 使用 snake_case：`annual_income`、`property_type`
- 保持参数名与业务术语一致，LLM 更容易理解

### 写好 description

`description` 是 LLM 理解参数语义的唯一线索。好的 description 应该：

- 说明参数的业务含义，而不是技术类型
- 包含示例值（如有必要）
- 说明特殊规则或约束

```
// 好
description: "借款人的年收入（美元），包含基本工资和奖金"

// 差
description: "年收入"
```

### 善用 Schema 组合

将通用结构抽取为独立 Schema，通过 includes 复用：

```
Schema: address_fields → [street, city, state, zip]
Schema: contact_info → [name, email, phone]

Schema: borrower_profile
  includes: [address_fields, contact_info]
  own: [ssn_last4, date_of_birth]
```

### 优先用 enumDatasetId

枚举值应该引用数据集（`enumDatasetId`），而不是内联在参数定义中。好处：

- 枚举值集中管理，修改一处全局生效
- 数据集可以在模板中复用
- 保持参数定义干净

### 保持 Schema 粒度合理

- 一个 Schema 对应一个业务概念（如"地址"、"借款人信息"）
- 避免把所有参数都堆在一个巨型 Schema 里
- 但也不要过度拆分——每个 Schema 至少应该有 2-3 个参数
