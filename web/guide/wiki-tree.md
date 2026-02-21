# Wiki 树形文档结构

Wiki 文档支持树形父子关系，侧边栏以可折叠树形结构展示。

## 数据模型

`wiki_documents` 表包含 `parent_id` 字段（自引用外键，`onDelete: "set null"`），以及 `order` 字段控制同级排序。

客户端类型 `WikiDocument`（`web/src/lib/wiki/types.ts`）包含 `parentId: string | null` 字段。

## API

### GET /api/wiki?agentId=xxx

返回所有文档的扁平数组，每个文档包含 `parentId` 字段。客户端在渲染时将扁平数组构建为树。

### POST /api/wiki

创建文档时可传 `parentId` 指定父文档：

```json
{ "agentId": "...", "name": "...", "key": "...", "parentId": "parent-uuid" }
```

不传 `parentId` 则创建为根级文档。

### PATCH /api/wiki/:id

支持更新 `parentId` 字段来移动文档：

```json
{ "parentId": "new-parent-uuid", "order": 0 }
```

传 `"parentId": null` 将文档移至根级。

## 客户端 API（web/src/lib/wiki/api.ts）

| 函数 | 说明 |
|------|------|
| `createDocument(docs, mutate, agentId, name, key, parentId?)` | 创建文档，可选指定父文档 |
| `moveDocument(id, parentId, docs, mutate)` | 移动文档到指定父节点或根级 |
| `reorderDocument(id, direction, docs, mutate, agentId?)` | 在同级兄弟间上下移动 |
| `deleteDocument(id, docs, mutate)` | 删除文档，子文档自动提升到根级 |

## 侧边栏 UI

### 树形构建

`WikiSidebar`（`web/src/components/wiki/wiki-sidebar.tsx`）使用 `buildTree()` 将扁平数组按 `parentId` 构建为 `WikiTreeNode[]` 树结构，每层按 `order` 排序。

### 展开/折叠

- 使用 `expandedIds: Set<string>` 管理展开状态（仅客户端，不持久化）
- 默认展开所有有子节点的文档
- 使用 Radix `Collapsible` 组件实现动画

### WikiTreeItem

`WikiTreeItem`（`web/src/components/wiki/wiki-tree-item.tsx`）递归渲染树节点：

- 有子节点：显示 `ChevronRightIcon` 箭头（点击切换展开/折叠）
- 无子节点：显示 `FileTextIcon`
- 子节点缩进：`ml-4 border-l pl-2`

DropdownMenu 操作：
- **Add Child**：在当前节点下新建子文档
- **Move Into >**：子菜单列出可选的目标文档，点击后将当前文档移入目标文档下（自动排除自身、当前父节点、所有后代节点防止循环）
- **Move Up One Level**：将文档移到祖父节点下（仅深度 >= 2 时显示，即父节点本身也是子节点）
- **Move to Root**：把子文档移到根级（仅非根级文档显示）
- **Move Up / Move Down**：在同级兄弟间排序
- **Delete**：删除文档（有子节点时提示子文档将移至根级）

## 删除行为

删除有子节点的文档时：
1. 数据库层面：子文档 `parent_id` 被设为 `NULL`（`onDelete: "set null"`）
2. 客户端乐观更新：子文档 `parentId` 设为 `null`，自动出现在根级
3. 确认弹窗提示："Its child documents will be moved to the root level."
