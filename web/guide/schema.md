# Schema 编辑指南

## 编辑器 Tab

| Tab | 说明 |
|-----|------|
| **Edit** | JSON Schema 编辑器，支持模板语法 |
| **Preview** | 模板渲染预览（有数据集时显示），`$ref` 自动展开 |
| **Parameters** | 参数列表（只读），直观查看当前 Schema 定义的字段 |

---

## 基础结构

Schema 使用标准 JSON Schema 7 格式：

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

支持的类型：`string`、`integer`、`number`、`boolean`、`object`、`array`、`null`

---

## 模板语法

在 enum 中使用 `{{ }}` 引用数据集变量，运行时自动展开为枚举值：

```json
{
  "type": "string",
  "enum": ["{{ us_states | json }}"]
}
```

编辑器输入 `{{` 时会自动补全可用的数据集变量名。

### 常用 filter

| 写法 | 适用场景 | 示例结果 |
|------|---------|---------|
| `{{ arr \| json }}` | 数组直接展开 | `["CA","TX"]` |
| `{{ obj \| keys \| json }}` | 取对象的 key | `["CA","NY"]` |
| `{{ obj \| values \| json }}` | 取对象的 value | `["California","New York"]` |
| `{{ arr \| map: "field" \| json }}` | 取数组对象的某字段 | `["Alice","Bob"]` |

### 展开规则

- 渲染结果是 JSON 数组（`[` 开头）→ 解析后展开为多个枚举值
- 否则 → 作为字面量字符串

可以混合使用模板和静态值：

```json
{ "enum": ["{{ us_states | json }}", "other"] }
```

---

## $ref 引用

通过 `$ref` 引用 Schemas 页面中定义的共享 Schema：

```json
{ "$ref": "#/$defs/address_fields" }
```

格式：`#/$defs/{schema_key}`，使用 Schema 的 key（snake_case）。

### allOf 组合

用 `allOf` + `$ref` 合并多个 Schema：

```json
{
  "allOf": [
    { "$ref": "#/$defs/contact_info" },
    { "$ref": "#/$defs/address_fields" }
  ],
  "type": "object",
  "properties": {
    "extra_field": { "type": "string" }
  }
}
```

---

## 枚举

```json
{ "type": "string", "enum": ["CA", "NY", "TX"] }
```

## 联合类型

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

```json
{ "anyOf": [{ "type": "string" }, { "type": "null" }] }
```

## 字符串约束

`minLength`、`maxLength`、`pattern`、`format`（email, url, uuid, date, date-time, time, ipv4, ipv6）

## 数值约束

`minimum`、`maximum`、`exclusiveMinimum`、`multipleOf`

## 数组

```json
{
  "type": "array",
  "items": { "type": "string" },
  "minItems": 1,
  "maxItems": 10
}
```
