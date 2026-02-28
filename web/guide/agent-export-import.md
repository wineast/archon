# Agent 导入/导出

## 导出

在 Agent 列表页，点击任意 Agent 卡片右上角的更多菜单（⋮），选择「导出」即可下载 ZIP 文件。

- **文件名**：`{agent.slug}.zip`
- **权限**：viewer 及以上（所有能看到 Agent 的用户均可导出）
- **内容**：
  - Agent 基本信息（name、description、icon、slug、isPublic、mcpEnabled、memoryEnabled、ragEnabled、skillsEnabled、contextCompressionEnabled）
  - 所有版本（version、changelog、snapshot），每个版本含完整快照（包括 chatConfig、memoryConfig 等）
  - `isEditing` / `isPublished` 标记标识当前编辑版本和已发布版本
  - Agent 关联的文件（如 PDF），以二进制打包在 ZIP 内
  - Embed Tokens（名称、允许来源、激活状态；不含 token 值，导入时重新生成）

## ZIP 结构

```
{slug}.zip
├── manifest.json          # AgentExportData JSON（含 files 元数据）
└── files/
    ├── example.pdf
    └── ...
```

- `manifest.json`：`AgentExportData` JSON，包含 `files` 和 `embedTokens` 字段
- `files/`：Agent 关联的文件二进制，路径与 `manifest.json` 中 `files[].zipPath` 对应

## 导入

在 Agent 列表页 header 区域，点击「导入」按钮，选择文件。

- **支持格式**：`.zip`
- **权限**：组织成员（member）及以上
- **行为**：
  - 始终在当前组织下创建**全新** Agent（不覆盖已有 Agent）
  - 如果 slug 冲突，自动追加后缀（如 `my-agent-2`）
  - 导入时自动执行格式版本迁移（见下方「格式版本迁移」章节）
  - 导入所有版本，恢复 editingVersionId 和 publishedVersionId 的指向
  - 每个版本的资源通过 `restoreSnapshot` 恢复为带 versionId 的行
  - ZIP 格式：自动从 ZIP 中提取文件并上传到 Vercel Blob，创建 `agentFiles` 记录
  - 如有 `embedTokens`，为每条记录生成新 token 值（`et_` + nanoid(32)）并插入数据库

## manifest.json 格式

```jsonc
{
  "exportVersion": 2,          // 格式版本号（当前最新版本）
  "exportedAt": "...",         // 导出时间 ISO 格式
  "agent": {
    "name": "...",
    "description": "...",
    "icon": "bot",
    "slug": "my-agent",
    "isPublic": false,
    "mcpEnabled": false,
    "memoryEnabled": false,
    "ragEnabled": false,
    "skillsEnabled": false,
    "contextCompressionEnabled": false
  },
  "versions": [
    {
      "version": "0.1.0",
      "changelog": "Initial version",
      "snapshot": { /* AgentSnapshot */ },
      "isEditing": false,
      "isPublished": false
    }
  ],
  "files": [],                  // Agent 关联文件元数据
  "embedTokens": []             // Embed Token 快照
}
```

## 格式版本迁移

导出格式通过 `exportVersion` 字段标识版本，导入时自动执行迁移脚本将旧格式升级到最新版本。

### 工作原理

```
导入旧 ZIP (v1)
  ↓
parseZipBody() → raw JSON
  ↓
validateExportData() → 验证基本结构 + 版本号 ∈ [1, CURRENT]
  ↓
migrateExportData() → 逐级执行迁移脚本（0002, 0003...）
  ↓
body 已升级到 CURRENT_EXPORT_VERSION（所有字段齐全）
  ↓
正常 insert agent + restoreSnapshot()
```

### 迁移文件结构

```
web/src/lib/versions/migrations/
├── index.ts                              # 注册表 + 执行器 + CURRENT_EXPORT_VERSION
├── 0002_normalize_optional_fields.ts     # v1 → v2
└── 0003_xxx.ts                           # v2 → v3（未来）
```

- 每个迁移脚本实现 `ExportMigration` 接口（`fromVersion`、`toVersion`、`migrate`）
- 模块加载时自动校验迁移链完整性（缺编号直接报错）
- `migrateExportData()` 对输入做 `structuredClone`，不修改原始数据

### 新增字段开发流程

以后新增导出字段只需 4 步：

1. **写迁移脚本** `0003_add_xxx.ts`（`fromVersion=2`, `toVersion=3`, 定义默认值）
2. **注册 + 版本号 +1**（`migrations/index.ts` 中 `CURRENT_EXPORT_VERSION = 3`，数组追加）
3. **更新 types.ts**（字段改为必需）
4. **写测试**（`migrations.test.ts` 中新增迁移测试用例）

TypeScript 编译器会自动标记所有构造 `AgentExportData` / `SnapshotItem` 时缺少新字段的位置。

## API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/agents/[id]/export` | GET | 导出 Agent 为 ZIP（viewer+） |
| `/api/agents/import?orgId=xxx` | POST | 导入 Agent ZIP（org member+） |

## 限制

- 不导出聊天会话、审计日志、使用量统计等运行时数据
- 不导出组织级配置（如 API Keys）
- Embed token 的 token 值不导出（安全考虑），导入时自动生成新 token
- 导入后 Agent 的 owner 为执行导入的用户
