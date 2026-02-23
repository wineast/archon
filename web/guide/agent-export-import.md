# Agent 导入/导出

## 导出

在 Agent 列表页，点击任意 Agent 卡片右上角的更多菜单（⋮），选择「导出」即可下载 ZIP 文件。

- **文件名**：`{agent.slug}.zip`
- **权限**：viewer 及以上（所有能看到 Agent 的用户均可导出）
- **内容**：
  - Agent 基本信息（name、description、icon、slug、isPublic、mcpEnabled、memoryEnabled、skillsEnabled、contextCompressionEnabled、scope）
  - 所有版本（version、changelog、snapshot），每个版本含完整快照（包括 chatConfig、memoryConfig 等）
  - `isEditing` / `isPublished` 标记标识当前编辑版本和已发布版本
  - Agent 关联的文件（如 PDF），以二进制打包在 ZIP 内

## ZIP 结构

```
{slug}.zip
├── manifest.json          # AgentExportData JSON（含 files 元数据）
└── files/
    ├── example.pdf
    └── ...
```

- `manifest.json`：与旧 JSON 导出格式一致的 `AgentExportData`，额外包含可选 `files` 字段描述文件元数据
- `files/`：Agent 关联的文件二进制，路径与 `manifest.json` 中 `files[].zipPath` 对应

## 导入

在 Agent 列表页 header 区域，点击「导入」按钮，选择文件。

- **支持格式**：`.zip`
- **权限**：组织成员（member）及以上
- **行为**：
  - 始终在当前组织下创建**全新** Agent（不覆盖已有 Agent）
  - 如果 slug 冲突，自动追加后缀（如 `my-agent-2`）
  - 导入所有版本，恢复 editingVersionId 和 publishedVersionId 的指向
  - 每个版本的资源通过 `restoreSnapshot` 恢复为带 versionId 的行
  - ZIP 格式：自动从 ZIP 中提取文件并上传到 Vercel Blob，创建 `agentFiles` 记录

## manifest.json 格式

```jsonc
{
  "exportVersion": 1,          // 格式版本号
  "exportedAt": "...",         // 导出时间 ISO 格式
  "agent": {
    "name": "...",
    "description": "...",
    "icon": "bot",
    "slug": "my-agent",
    "isPublic": false,
    "mcpEnabled": false,
    "memoryEnabled": false,
    "skillsEnabled": false,
    "contextCompressionEnabled": false,
    "scope": "org"
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
  "files": [                    // 可选，有文件时才出现
    {
      "name": "rate-sheet.pdf",
      "contentType": "application/pdf",
      "size": 102400,
      "zipPath": "files/rate-sheet.pdf"
    }
  ]
}
```

## API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/agents/[id]/export` | GET | 导出 Agent 为 ZIP（viewer+） |
| `/api/agents/import?orgId=xxx` | POST | 导入 Agent ZIP（org member+） |

## 限制

- 不导出聊天会话、审计日志、使用量统计等运行时数据
- 不导出组织级配置（如 API Keys）
- 导入后 Agent 的 owner 为执行导入的用户
