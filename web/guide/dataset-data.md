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

## 跨资源引用

数据集支持链式引用，系统自动按依赖排序渲染：

```
a = "Root"
b = "{{a}}-Mid"     → "Root-Mid"
c = "{{b}}-End"     → "Root-Mid-End"
```

循环依赖（a→b→a）会在保存时报错。

