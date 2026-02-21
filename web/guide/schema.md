# JSON Schema 编辑指南

## 工具 / 函数参数 Schema 约束

工具和函数的参数 Schema **顶层必须是 `type: "object"`**，`properties` 中的每个字段对应一个参数。不能使用数组、字符串等非 object 类型作为顶层结构。

正确示例：

```json
{
  "type": "object",
  "properties": {
    "query": { "type": "string", "description": "搜索关键词" },
    "limit": { "type": "integer", "minimum": 1, "maximum": 100 }
  },
  "required": ["query"]
}
```

错误示例（顶层不是 object）：

```json
["string", "integer"]
```

```json
{ "type": "array", "items": { "type": "string" } }
```

## 基础结构

Schema 使用标准 JSON Schema 7 格式定义数据结构：

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string", "description": "借款人姓名" },
    "age": { "type": "integer", "minimum": 18 }
  },
  "required": ["name", "age"]
}
```

## 支持的类型

| 类型 | 示例 | Zod 映射 |
|------|------|---------|
| string | `{ "type": "string" }` | `z.string()` |
| integer | `{ "type": "integer" }` | `z.number().int()` |
| number | `{ "type": "number" }` | `z.number()` |
| boolean | `{ "type": "boolean" }` | `z.boolean()` |
| object | `{ "type": "object", "properties": {...} }` | `z.object({...})` |
| array | `{ "type": "array", "items": {...} }` | `z.array(...)` |
| null | `{ "type": "null" }` | `z.null()` |

## 枚举（Enum）

枚举是 string 类型的约束：

```json
{ "type": "string", "enum": ["CA", "NY", "TX"] }
```

## 模板字符串

在 enum 中使用数据集变量，运行时自动展开：

```json
{ "enum": ["{{state_enum}}"] }
```

## 引用其他 Schema（$ref）

通过 `$ref` 引用其他 Schema，实现复用：

```json
{ "$ref": "#/$defs/address_fields" }
```

格式为 `#/$defs/{schema_key}`，使用 Schema 的 key（snake_case）。

## 组合 Schema（allOf）

使用 `allOf` + `$ref` 合并多个 Schema：

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

## 联合类型（Union）

使用 `oneOf` 或 `anyOf`：

```json
{
  "oneOf": [
    { "type": "object", "properties": { "content": { "type": "string" } } },
    { "type": "object", "properties": { "url": { "type": "string" } } }
  ],
  "x-discriminator": "kind",
  "x-discriminatorValues": ["text", "image"]
}
```

## Nullable

使用 `anyOf` 模式：

```json
{ "anyOf": [{ "type": "string" }, { "type": "null" }] }
```

## 字符串约束

| 约束 | 示例 |
|------|------|
| minLength | `"minLength": 1` |
| maxLength | `"maxLength": 100` |
| pattern | `"pattern": "^\\d{5}$"` |
| format | `"format": "email"` |

支持的 format：email, url, uuid, date, date-time, time, ipv4, ipv6

## 数值约束

| 约束 | 示例 |
|------|------|
| minimum | `"minimum": 0` |
| maximum | `"maximum": 100` |
| exclusiveMinimum | `"exclusiveMinimum": 0` |
| multipleOf | `"multipleOf": 0.01` |

## 数组

```json
{
  "type": "array",
  "items": { "type": "string" },
  "minItems": 1,
  "maxItems": 10,
  "uniqueItems": true
}
```

Tuple 模式：

```json
{
  "type": "array",
  "prefixItems": [{ "type": "number" }, { "type": "string" }]
}
```
