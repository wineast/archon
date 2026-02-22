# 系统提示词编辑参考

系统提示词（System Prompt）使用 LiquidJS 模板语法编写，在每次对话开始时自动渲染，注入数据集、工具定义、Wiki 文档等动态内容。

---

## LiquidJS 语法

### 变量插值

```liquid
{{company_name}}
{{income_type_enum.w2}}
```

### 条件判断

```liquid
{% if bilingual %}
请使用双语回复。
{% endif %}

{% if role == "admin" %}
管理员模式。
{% elsif role == "editor" %}
编辑模式。
{% else %}
只读模式。
{% endif %}

{% unless debug %}
生产环境。
{% endunless %}
```

### 循环

```liquid
{% for t in tool_entries %}
- **{{t.name}}**：{{t.description}}
{% endfor %}
```

`forloop` 对象属性：

| 属性 | 说明 |
|------|------|
| `forloop.index` | 从 1 开始的序号 |
| `forloop.index0` | 从 0 开始的序号 |
| `forloop.first` | 是否第一项 |
| `forloop.last` | 是否最后一项 |

### 引用 Wiki 文档

```liquid
{% include 'loan_guide' %}
```

按文档 **key** 匹配。支持嵌套引用，系统自动检测循环引用。

---

## 可用变量

### 内置时间变量

| 变量 | 示例值 | 说明 |
|------|--------|------|
| `{{date}}` | `2026-02-17` | ISO 日期 |
| `{{time}}` | `14:30:00` | 时间 |
| `{{datetime}}` | `2026-02-17T14:30:00.000Z` | ISO 完整时间 |
| `{{timestamp}}` | `1739800200000` | Unix 毫秒时间戳 |
| `{{year}}` | `2026` | 年 |
| `{{month}}` | `02` | 月（补零） |
| `{{day}}` | `17` | 日（补零） |

### 数据集变量

数据集中配置的所有数据均可直接引用：

```liquid
{{company_name}}          → "GMCC"
{{income_type_enum.w2}}   → "Full Doc - W2 Wage Earner"
```

对象用点号访问子字段，数组用 `{% for %}` 遍历。

### 工具命名空间

通过 `tool.{name}` 访问单个工具的定义信息：

```liquid
{{tool.calculate_dti.name}}
{{tool.calculate_dti.description}}
{% for p in tool.calculate_dti.parameters %}
- {{p.name}} ({{p.type}}): {{p.description}}
{% endfor %}
```

`tool_entries` 是所有已启用工具的数组，可遍历：

```liquid
可用工具：{{tool_entries | map: "name" | join: ", "}}

{% for t in tool_entries %}
### {{t.name}}
{{t.description}}
{% endfor %}
```

每个工具条目的字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 工具名称 |
| `description` | string | 工具描述 |
| `parameters` | array | 参数数组，每项有 `name`、`type`、`description`、`required`、`enum` |

### 本体类型变量

`ontology_types` 是所有本体类型的数组：

```liquid
{% for type in ontology_types %}
- {{type.key}}：{{type.name}} — {{type.description}}
  属性：{% for prop in type.properties %}{{prop.name}}({{prop.type}}){% unless forloop.last %}, {% endunless %}{% endfor %}
{% endfor %}
```

`ontology.{key}` 按 key 直接访问单个类型：

```liquid
{{ontology.customer.name}}
```

每个类型条目的字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | string | 类型标识 |
| `name` | string | 类型名称 |
| `description` | string | 类型描述 |
| `icon` | string | 图标 |
| `color` | string | 颜色 |
| `properties` | array | 属性数组，每项有 `name`、`type`、`required`、`description` |
| `relations` | array | 关系数组，每项有 `key`、`name`、`targetKey`、`targetName`、`relationType`、`inverseName` |

### 宿主变量（embed 模式）

当 Agent 以 embed widget 方式嵌入宿主页面时，宿主通过 postMessage 传入的上下文变量可用 `host.` 前缀访问：

```liquid
{{host.userName}}
{{host.currentPage}}
```

---

## Filter

用管道符 `|` 对变量做格式化：

### 常用内置 Filter

| Filter | 说明 | 示例 |
|--------|------|------|
| `upcase` | 转大写 | `{{name \| upcase}}` |
| `downcase` | 转小写 | `{{name \| downcase}}` |
| `join` | 数组拼接 | `{{list \| join: ", "}}` |
| `truncate` | 截断到指定长度 | `{{text \| truncate: 100}}` |
| `map` | 取数组每项的指定字段 | `{{tool_entries \| map: "name"}}` |
| `split` | 字符串分割为数组 | `{{csv \| split: ","}}` |
| `size` | 返回数组/字符串长度 | `{{items \| size}}` |

> 完整的 LiquidJS 内置 Filter 列表参见 [LiquidJS 文档](https://liquidjs.com/filters/overview.html)。

---

## 变量优先级

当同名变量有多个来源时，优先级从高到低：

1. 调用时传入的额外变量（如 `host.*`）
2. 数据集变量
3. 内置时间变量

`tool.*`、`ontology.*` 为独立命名空间，不参与覆盖。

---

## 示例

```liquid
你是 {{company_name}} 的 AI 顾问。今天是 {{date}}。

## 可用工具
{% for t in tool_entries %}
- **{{t.name}}**：{{t.description}}
{% endfor %}

## 业务知识
{% include 'company_policies' %}
{% include 'product_faq' %}

{% if host.currentPage %}
用户当前正在查看页面：{{host.currentPage}}
{% endif %}
```

---

## 注意事项

- **保留字**：`tool`、`tool_entries` 不能用作数据集 key
- **未定义变量**：引用不存在的变量渲染为空，不会报错
- **语法错误**：模板语法有误时返回原始文本，不影响系统运行
- **渲染时机**：每次对话开始时渲染一次，注入当时的所有数据
