# Wiki 内容模板语法

在 Wiki 文档的 Content 编辑器中，你可以使用模板语法来动态生成内容。模板会在预览和实际使用时自动渲染。

---

## 变量插值

用双花括号 `{{变量名}}` 引用数据：

```liquid
你好，欢迎使用 {{company_name}} 的服务。
今天是 {{date}}。
```

### 数据集变量

所有在「数据集」中配置的数据都可以直接引用：

```liquid
{{company_name}}
→ GMCC

{{income_type_enum.w2}}
→ Full Doc - W2 Wage Earner
```

对象类型用点号访问子字段，数组类型用于循环遍历。

### 内置变量

以下变量自动可用，无需配置：

| 变量 | 示例值 | 说明 |
|------|--------|------|
| `{{date}}` | `2026-02-17` | 日期 |
| `{{time}}` | `14:30:00` | 时间 |
| `{{datetime}}` | `2026-02-17T14:30:00.000Z` | 完整时间 |
| `{{year}}` | `2026` | 年 |
| `{{month}}` | `02` | 月（补零） |
| `{{day}}` | `17` | 日（补零） |

---

## 条件判断

根据变量值显示不同内容：

```liquid
{% if bilingual %}
请使用双语回复。
{% endif %}
```

多分支判断：

```liquid
{% if role == "admin" %}
你拥有管理员权限。
{% elsif role == "editor" %}
你拥有编辑权限。
{% else %}
你拥有只读权限。
{% endif %}
```

反向判断（当变量不存在或为假时显示）：

```liquid
{% unless debug %}
这是生产环境。
{% endunless %}
```

---

## 循环

遍历数组类型的数据：

```liquid
支持语言：
{% for lang in languages %}
- {{lang}}
{% endfor %}
```

循环内可用 `forloop` 获取序号等信息：

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

## 引用其他 Wiki 文档

在当前文档中嵌入另一篇 Wiki 文档的内容：

```liquid
{% include '贷款指南' %}
```

- 按文档 **key** 精确匹配
- 支持嵌套引用（A 引用 B，B 引用 C）
- 系统自动检测循环引用，避免死循环

---

## Filter

用管道符 `|` 对变量做格式化处理：

```liquid
{{languages | join: "、"}}
→ en、zh、es

{{company_name | upcase}}
→ ACME CORP

{{company_name | downcase}}
→ acme corp

{{description | truncate: 50}}
→ 这是一段很长的描述文字，会被截断到五十个字符...
```

常用 filter：

| Filter | 说明 | 示例 |
|--------|------|------|
| `upcase` | 转大写 | `{{name \| upcase}}` |
| `downcase` | 转小写 | `{{name \| downcase}}` |
| `join` | 数组拼接为字符串 | `{{list \| join: ", "}}` |
| `truncate` | 截断到指定长度 | `{{text \| truncate: 100}}` |

---

## 注意事项

- **未定义变量**：引用不存在的变量会渲染为空，不会报错
- **语法错误**：模板语法有误时返回原始文本，不影响正常使用
