# 本体（Ontology）设计文档

本体层是 Agent 下的新资源类型，用"领域对象"将现有散件（Schema、Tool、Component、Wiki、Dataset）串成一张语义网络。

> **一句话定义**：本体 = 让 AI 理解"业务里有哪些东西、它们之间什么关系、能对它们做什么"的结构化描述。

---

## 动机

现有资源体系的不足：

| 现有资源 | 能做什么 | 缺什么 |
|----------|---------|--------|
| Schema | 定义字段结构 | 只服务于工具 I/O，没有独立的领域实体概念 |
| Dataset | 存储 JSON 数据 | 扁平 JSON，无类型约束，关系靠 Liquid 字符串拼接 |
| Wiki | 存储知识文档 | 非结构化，不能被程序化查询 |
| Tool | 定义 AI 可执行的操作 | 不声明"作用于哪个实体" |
| Component | 定义 UI 渲染 | 不声明"渲染哪种实体" |

**缺失的一层**：把散件用"领域对象"串起来的语义层。

参考：Palantir Ontology 的核心思路 —— 在数据之上建语义模型，让人和 AI 用同一种语言理解业务。

---

## 架构定位

```
Agent
 ├── 现有资源
 │   Schema / Tool / Function / Component / Wiki / Dataset / ModelConfig / ...
 │
 └── 🆕 Ontology（本体层）
      ├── ObjectType   —— 领域对象类型
      ├── Relation      —— 类型之间的关系
      ├── Instance       —— 对象实例（运行时数据）
      ├── Link           —— 实例间关联
      └── Action 绑定    —— 对象类型 ↔ Tool 映射
```

---

## 数据库设计

### object_types — 对象类型

定义一类领域实体（如"借款人""房产""贷款产品"）。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | — |
| agentId | uuid FK → agents | Agent 作用域 |
| key | text UNIQUE(agentId, key) | 稳定标识，快照用 |
| name | text | 显示名（"借款人"） |
| description | text | 给 AI 看的语义描述 |
| icon | text | Lucide icon name |
| color | text | 标识色（hex） |
| schemaId | uuid FK → schemas | ⭐ 复用 Schema 定义属性 |
| displayComponentId | uuid FK → components | 渲染组件（可选） |
| titleProperty | text | 哪个属性字段作为实例标题 |
| source | enum('internal', 'external') | 数据来源 |
| externalConfig | jsonb | 外部数据源配置 |
| order | integer | 排序 |
| createdAt | timestamp | — |
| updatedAt | timestamp | — |

**关键决策**：属性定义复用 `schemas` 表。ObjectType 的 `schemaId` 指向一个 Schema，Schema 的 `parameters` 就是对象的属性列表。已有的类型系统（string/number/boolean/enum/json、嵌套、schema 组合、dataset enum 引用）全部可复用。

### object_relations — 关系定义

声明两个对象类型之间的关系。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | — |
| agentId | uuid FK → agents | Agent 作用域 |
| key | text UNIQUE(agentId, key) | 稳定标识 |
| name | text | 关系名（"申请了"） |
| description | text | "借款人申请贷款产品" |
| sourceTypeId | uuid FK → object_types | 起点类型 |
| targetTypeId | uuid FK → object_types | 终点类型 |
| relationType | enum | has_one / has_many / belongs_to / many_to_many |
| inverseName | text | 反向名称（"被申请"） |
| order | integer | 排序 |
| createdAt | timestamp | — |
| updatedAt | timestamp | — |

### object_instances — 对象实例

存储具体的领域对象数据。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | — |
| agentId | uuid FK → agents | Agent 作用域 |
| objectTypeId | uuid FK → object_types | 所属类型 |
| label | text | 从 titleProperty 自动生成 |
| data | jsonb | 符合 Schema 的结构化数据 |
| createdBy | uuid FK → users | 创建者（用户或 AI） |
| createdAt | timestamp | — |
| updatedAt | timestamp | — |

### object_links — 实例间关联

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | — |
| agentId | uuid FK → agents | Agent 作用域 |
| relationId | uuid FK → object_relations | 所属关系定义 |
| sourceId | uuid FK → object_instances | 起点实例 |
| targetId | uuid FK → object_instances | 终点实例 |
| metadata | jsonb | 关系附加数据（如"申请日期"） |
| createdAt | timestamp | — |

### object_type_actions — 对象类型 ↔ Tool 绑定

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | — |
| agentId | uuid FK → agents | Agent 作用域 |
| objectTypeId | uuid FK → object_types | 对象类型 |
| toolId | uuid FK → tools | 关联工具 |
| actionType | enum | create / read / update / delete / query / custom |
| order | integer | 排序 |

---

## 与现有系统集成

### 1. Template 模板层

在 `gatherTemplateData()` 中注入 ontology 命名空间：

```liquid
你管理以下业务对象：
{% for type in ontology_types %}
- **{{ type.name }}**：{{ type.description }}
  属性：{% for prop in type.properties %}{{ prop.name }}({{ prop.type }}){% unless forloop.last %}, {% endunless %}{% endfor %}
  {% for rel in type.relations %}
  → {{ rel.name }}: {{ rel.targetName }}（{{ rel.relationType }}）
  {% endfor %}
{% endfor %}
```

模板变量：

| 变量 | 类型 | 说明 |
|------|------|------|
| `ontology_types` | array | 所有对象类型（含属性和关系） |
| `ontology.{key}` | object | 按 key 访问单个类型 |
| `ontology.{key}.properties` | array | 该类型的属性列表 |
| `ontology.{key}.relations` | array | 该类型的关系列表 |

### 2. ToolContext 扩展

工具 handler 内通过 `context.ontology` 操作实例：

```typescript
// 类型查询
context.ontology.types()                              // 列出所有对象类型
context.ontology.type('Borrower')                      // 获取类型定义

// 实例 CRUD
context.ontology.query('Borrower', { state: 'CA' })    // 查询实例
context.ontology.get('Borrower', instanceId)            // 获取单个（含关系）
context.ontology.create('Borrower', data)               // 创建
context.ontology.update('Borrower', id, data)           // 更新
context.ontology.delete('Borrower', id)                 // 删除

// 关系操作
context.ontology.link(sourceId, 'applies_for', targetId)   // 建立关联
context.ontology.unlink(sourceId, 'applies_for', targetId) // 解除关联
context.ontology.graph('Borrower', id, { depth: 2 })       // 关系图谱
```

### 3. 版本快照

```typescript
interface AgentSnapshot {
  // ... 现有字段
  objectTypes: ObjectTypeSnapshotItem[]         // ✅ 类型定义纳入快照
  objectRelations: ObjectRelationSnapshotItem[] // ✅ 关系定义纳入快照
  // ⚠️ instances 和 links 是运行时数据，不纳入快照
}
```

### 4. 自动 CRUD 工具生成

定义 ObjectType 后，可一键生成 CRUD 工具：

```
ObjectType "Borrower" (schema: name, phone, state, income_type)
    ↓ 自动生成
├── Tool: "create_borrower"   (params = schema)
├── Tool: "query_borrowers"   (params = filter conditions)
├── Tool: "update_borrower"   (params = id + partial schema)
└── Tool: "get_borrower"      (params = id, 返回含关系的完整对象)
```

---

## 数据来源

| source 值 | 说明 | 适用场景 |
|-----------|------|---------|
| `internal` | 数据存 object_instances 表 | Agent 管理的配置、聊天中收集的信息 |
| `external` | 通过 API 获取 | 对接企业 CRM/ERP |
| `host`（未来） | 通过 postMessage 从宿主获取 | 嵌入式部署 |

external 模式的 `externalConfig` 示例：

```json
{
  "type": "api",
  "baseUrl": "https://crm.company.com/api",
  "endpoints": {
    "query":  { "method": "GET",  "path": "/borrowers" },
    "get":    { "method": "GET",  "path": "/borrowers/:id" },
    "create": { "method": "POST", "path": "/borrowers" }
  },
  "auth": {
    "type": "bearer",
    "tokenDatasetKey": "crm_api_token"
  }
}
```

---

## UI 设计

### 资源面板入口

Agent 编辑器左侧资源面板新增 **"本体"** 标签页：

```
┌──────────────────────────────────────┐
│ 📋 工具  📄 Wiki  📊 数据集  🧬 本体  │
├──────────────────────────────────────┤
│                                      │
│  [+ 新建对象类型]                     │
│                                      │
│  👤 借款人 (Borrower)                │
│     属性: 姓名, 电话, 州, 收入类型     │
│     关系: → 贷款产品, → 房产          │
│                                      │
│  🏠 房产 (Property)                  │
│     属性: 地址, 估值, 类型             │
│     关系: → 借款人                    │
│                                      │
│  📦 贷款产品 (LoanProduct)            │
│     属性: 名称, 利率范围, 适用条件      │
│     关系: ← 借款人                    │
│                                      │
│  ─────── 关系图谱视图 ───────         │
│                                      │
│    [借款人] ──申请──→ [贷款产品]       │
│       │                               │
│      拥有                              │
│       ↓                               │
│    [房产]                              │
│                                      │
└──────────────────────────────────────┘
```

### 对象类型详情

```
┌──────────────────────────────────────────┐
│ 👤 借款人 (Borrower)               [保存] │
├──────────────────────────────────────────┤
│ 基本信息                                  │
│   Key:  borrower  (只读)                  │
│   名称: 借款人                             │
│   描述: 申请贷款的个人或实体               │
│   数据源: ○ 内部  ● 外部 API              │
│                                          │
│ 属性 (→ Schema 编辑器)                    │
│   ┌─────────┬────────┬──────┐           │
│   │ 字段名   │ 类型    │ 必填 │           │
│   ├─────────┼────────┼──────┤           │
│   │ name    │ string │  ✓  │            │
│   │ phone   │ string │  ✓  │            │
│   │ state   │ enum   │  ✓  │ → state_enum│
│   │ income  │ enum   │  ✓  │ → income_..│
│   └─────────┴────────┴──────┘           │
│                                          │
│ 关系                                      │
│   → applies_for: 贷款产品 (has_many)      │
│   → owns: 房产 (has_many)                │
│   [+ 添加关系]                            │
│                                          │
│ 绑定操作                                  │
│   🔧 create_borrower (创建)              │
│   🔧 query_borrowers (查询)              │
│   [+ 自动生成 CRUD]  [+ 绑定已有工具]      │
│                                          │
│ 实例数据 / API 配置                        │
│   (根据 source 显示不同内容)               │
│                                          │
└──────────────────────────────────────────┘
```

---

## 实施路线

| 阶段 | 内容 | 价值 |
|------|------|------|
| **P0** | object_types + object_relations 表 + 管理 UI + 模板注入 | AI 自动获得结构化领域模型，替代手写 Wiki 描述 |
| **P1** | object_instances + object_links + ToolContext 扩展 | Agent 可以存储和操作业务数据 |
| **P2** | 自动 CRUD 工具生成 + 外部数据源 | 定义类型即获得完整操作能力 |
| **P3** | 关系图谱可视化 + 行业模板导入导出 | FDE 快速复制已有方案 |
| **P4** | 对话式本体构建（母 Agent 引导 FDE 定义） | 非技术人员自助完成 |

---

## 与商业模式的契合

1. **FDE 工作流**：FDE 梳理业务 → 在本体面板定义对象和关系 → 系统自动生成 AI 工具 → Agent 即刻能聊业务
2. **行业模板沉淀**：每次部署的 ObjectType 定义可打包为行业模板（贷款、零售、物流...），下次直接导入
3. **对话式配置基础**：母 Agent 引导 FDE "你的业务涉及哪些实体？" → 自动创建 ObjectType + Relation
