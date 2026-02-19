# Schema 使用指南

Schema 是系统的可复用参数定义层。工具（Tool）、函数（Function）、对象类型（Object Type）共享同一套 Schema 机制来描述数据结构。Schema 定义存储在数据库中（JSONB），运行时自动转换为 Zod 校验 + JSON Schema（发给 LLM），形成三层架构。

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

### 六种基础类型

| 类型 | 说明 | Zod 映射 | JSON Schema 映射 |
|------|------|---------|-----------------|
| `string` | 字符串 | `z.string()` | `{"type":"string"}` |
| `number` | 数值（含浮点） | `z.number()` | `{"type":"number"}` |
| `boolean` | 布尔值 | `z.boolean()` | `{"type":"boolean"}` |
| `enum` | 枚举（固定可选值） | `z.enum([...])` | `{"type":"string","enum":[...]}` |
| `object` | 嵌套对象 | `z.object({...})` | `{"type":"object","properties":{...}}` |
| `array` | 数组 | `z.array(...)` | `{"type":"array","items":{...}}` |

### 参数公共字段

每个参数（不论类型）都有以下基础字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 参数名，作为 JSON key |
| `type` | SchemaPropertyType | 是 | 数据类型 |
| `description` | string | 是 | 参数描述，LLM 会看到 |
| `required` | boolean | 是 | 是否必填 |
| `defaultValue` | unknown | 否 | 默认值（规划中，尚未在运行时生效） |

> **注意**：`description` 非常重要——它会通过 JSON Schema 的 `description` 字段传递给 LLM，直接影响 LLM 对参数语义的理解。

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

**三种枚举值来源**（按优先级排列）：

1. **enumDatasetId**（推荐）：引用一个数据集（Dataset）的 UUID，运行时从数据集解析枚举值
2. **enumRef**（已废弃）：引用数据集的 key，通过 resolvedVars 解析
3. **enum**（内联）：直接在参数定义中写死枚举值数组

```
解析优先级：enumDatasetId > enumRef > inline enum
```

**数据集解析规则**：

| 数据集类型 | 解析方式 | 示例 |
|-----------|---------|------|
| 数组 | 直接使用 | `["CA","NY","TX"]` → enum `["CA","NY","TX"]` |
| 对象（值为字符串） | 取 values | `{"w2":"W2 Income","se":"Self Employed"}` → enum `["W2 Income","Self Employed"]` |
| 对象（值为非字符串） | 取 keys | `{"a":1,"b":2}` → enum `["a","b"]` |

**无枚举值时的行为**：当 `type: "enum"` 但所有来源都无法解析出枚举值时，退化为 `z.string()`（会打印警告日志）。

### object

嵌套对象类型，有两种定义方式：

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

运行时会从 schemaMap 中查找该 Schema 的参数列表，展开为嵌套对象。

**无 properties 且无 schemaId 时**：退化为 `z.unknown()`，接受任意数据。

### array

数组类型，通过 `items` 字段定义元素的类型。

| 约束 | 类型 | Zod | JSON Schema | 说明 |
|------|------|-----|-------------|------|
| `items` | SchemaProperty | 递归构建 | `"items":{...}` | 元素类型定义 |
| `minItems` | number | `.min(n)` | `"minItems":n` | 最少元素数 |
| `maxItems` | number | `.max(n)` | `"maxItems":n` | 最多元素数 |
| `uniqueItems` | boolean | — | — | 元素唯一（已定义，尚未实现） |

**无 items 时**：元素类型为 `z.unknown()`，接受任意类型的元素。

**嵌套示例**：

```
参数: tags (type: array)
  └── items: (type: string, minLength: 1)

参数: contacts (type: array, minItems: 1)
  └── items: (type: object)
      └── properties:
          ├── name (type: string, required)
          └── phone (type: string, format: "phone")
```

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

Schema 在系统中经历三次转换：

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: SchemaProperty[]（数据库）                  │
│  存储在 schemas.parameters (JSONB) 中                │
│  人类可读、可编辑的参数定义                             │
└──────────────────────┬──────────────────────────────┘
                       │ buildInputSchema()
                       ▼
┌─────────────────────────────────────────────────────┐
│  Layer 2: Zod Schema（运行时）                        │
│  z.object({ name: z.string().min(1), ... })         │
│  用于 LLM 工具调用结果的运行时校验                      │
└──────────────────────┬──────────────────────────────┘
                       │ AI SDK 自动转换（zod-to-json-schema）
                       ▼
┌─────────────────────────────────────────────────────┐
│  Layer 3: JSON Schema（发给 LLM）                     │
│  {"type":"object","properties":{"name":{...}}}      │
│  LLM 基于此 schema 生成工具调用参数                    │
└─────────────────────────────────────────────────────┘
```

### 转换细节

**Layer 1 → Layer 2**（`buildInputSchema`）：

代码位于 `web/src/lib/tools/schema-builder.ts`。入参为 `SchemaProperty[]`，返回 `z.ZodObject`。关键行为：

- `required: false` → `.optional()`
- `description` → `.describe(text)`
- enum 值从 `datasetsById` / `resolvedVars` / 内联 `enum` 解析
- object 的 `schemaId` 从 `schemaMap` 解析
- 嵌套 object 使用 `.passthrough()`（允许额外字段）

**Layer 2 → Layer 3**（AI SDK 隐式完成）：

由 Vercel AI SDK 的 `tool()` 函数内部调用 `zod-to-json-schema`，开发者无需手动操作。大部分 Zod 方法都有对应的 JSON Schema 表示，少数例外：

| Zod | JSON Schema | 是否对齐 |
|-----|-------------|---------|
| `z.string().min(3)` | `{"minLength":3}` | 对齐 |
| `z.number().int()` | `{"type":"integer"}` | 对齐 |
| `z.enum(["a","b"])` | `{"enum":["a","b"]}` | 对齐 |
| `z.string().email()` | `{"format":"email"}` | 对齐 |
| `.optional()` | 不在 `required` 数组中 | 对齐 |
| `.describe("...")` | `{"description":"..."}` | 对齐 |
| `.refine(fn)` | 无对应 | **不对齐**（信息丢失） |

---

## 运行时流程

当用户发送消息、LLM 决定调用工具时，Schema 的完整生命周期如下：

```
1. 加载工具定义
   └── 从 DB 读取 tool.parametersSchemaId → schemas 表

2. 解析 Schema
   └── 递归解析 includes → 合并参数列表
   └── 解析 enum 的 enumDatasetId → 从 datasets 获取值
   └── 解析 object 的 schemaId → 从 schemaMap 获取子参数

3. 构建 Zod Schema
   └── buildInputSchema(resolvedParameters, resolvedVars, options)
   └── 返回 z.object({...})

4. 注册为 AI SDK Tool
   └── tool({ description, inputSchema: zodSchema, execute })
   └── AI SDK 自动将 Zod 转为 JSON Schema

5. LLM 生成工具调用
   └── LLM 根据 JSON Schema 生成参数 JSON
   └── AI SDK 用 Zod Schema 校验参数
   └── 校验通过 → 执行 handler
   └── 校验失败 → 报错

6. 输出验证（可选）
   └── 如果配置了 returnParametersSchemaId
   └── 用同样的流程构建输出 Zod Schema
   └── 校验 handler 返回值
```

---

## 已知限制

以下是当前 Schema 系统的已知限制，对应的 issue 已记录在 `backlog/open/` 下：

| 限制 | 影响 | Issue |
|------|------|-------|
| `defaultValue` 未在 Zod 层实现 | 默认值不生效，LLM 看不到 | `schema-defaultvalue-not-implemented.md` |
| `uniqueItems` 未在 Zod 层实现 | 数组唯一性约束不生效 | `schema-uniqueitems-not-implemented.md` |
| 嵌套 object 有 `passthrough`，顶层没有 | 额外字段处理不一致 | `schema-passthrough-inconsistency.md` |
| 无显式 JSON Schema 生成 | 无法导出标准 JSON Schema | `schema-no-explicit-jsonschema-generation.md` |
| 不支持 Map/Record 类型 | 无法表达动态 key 结构 | `schema-no-map-type.md` |
| 不支持 Union 类型 | 无法表达"A 或 B"的参数 | `schema-no-union-type.md` |
| 不支持递归类型 | 无法表达树形结构 | `schema-no-recursive-type.md` |

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
