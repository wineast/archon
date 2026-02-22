# Data 编辑指南

数据集的 Data 字段存储实际数据内容，支持纯 JSON 和 Liquid 模板两种模式。

---

## 编辑器模式

| 模式 | 语言 | 实时校验 |
|------|------|---------|
| JSON | JSON 语法高亮 | `JSON.parse` 实时验证 |
| Template | Liquid 语法高亮 | 无（模板语法不是合法 JSON） |

- **Edit** Tab：编辑文本，纯 JSON 有实时校验
- **Preview** Tab：渲染模板后显示最终结果，验证输出是否为合法 JSON

---

## 数据类型示例

### 简单字符串

```json
"GMCC"
```

模板引用：`{{company_name}}` → `GMCC`

### 枚举映射（对象）

```json
{
  "w2": "Full Doc - W2 Wage Earner",
  "self_employed": "NQM - 1year Self Employed"
}
```

模板引用：`{{income_type_enum.w2}}` → `Full Doc - W2 Wage Earner`

### 列表（数组）

```json
["en", "zh", "es"]
```

模板中循环：

```liquid
{% for lang in languages %}
- {{lang}}
{% endfor %}
```

---

## 变量范围

数据集模板的渲染上下文**仅包含前序数据集**（按拓扑排序已解析的数据集）：

- **可用**：其他数据集的值（`{{other_dataset_key}}`、`{{other_dataset_key.field}}`）
- **不可用**：内置时间变量（`date`/`time` 等）、工具命名空间（`tool.*`/`tool_entries`）、本体类型（`ontology.*`）
- **不支持**：`{% include 'wiki_key' %}` 引用 Wiki 文档

这种限制是为了避免与最终模板渲染产生循环依赖。

---

## 自定义 Filter

数据集渲染器注册了以下自定义 Filter（除 LiquidJS 内置 Filter 外）：

| Filter | 输入 | 输出 | 说明 |
|--------|------|------|------|
| `json` | 任意值 | JSON 字符串 | `JSON.stringify(value)` |
| `keys` | 对象 | 字符串数组 | `Object.keys()`；数组/其他值原样返回 |
| `values` | 对象 | 值数组 | `Object.values()`；数组/其他值原样返回 |

---

## 模板语法（Liquid）

数据中可以引用其他数据集的值：

```json
{
  "incomes": ["{{income_type_enum.w2}}", "{{income_type_enum.self_employed}}"]
}
```

支持完整 Liquid 控制流：

```liquid
{
  "products": [
    {% for p in product_routes %}
    { "name": "{{p.name}}" }{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ]
}
```

模板渲染后应产出合法 JSON，可通过 Preview tab 验证。

---

## 跨资源引用（拓扑排序渲染）

数据集支持链式引用。系统使用 **Kahn 拓扑排序算法**自动分析依赖关系，按依赖顺序逐个渲染：

```
a = "Root"            （无依赖，先渲染）
b = "{{a}}-Mid"       （依赖 a）→ "Root-Mid"
c = "{{b}}-End"       （依赖 b）→ "Root-Mid-End"
```

支持 N 层深度链式引用。

### 循环依赖检测

如果存在循环依赖（如 a→b→a），系统在保存时会报错。依赖分析基于模板中出现的变量名：`{{ var }}`、`{% for x in var %}`、`{% if var %}` 等。

