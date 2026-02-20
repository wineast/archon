# 文件（Files）模块

文件模块用于上传和管理 Agent 的知识库文件，当前支持 PDF 格式。

## 功能

- 上传 PDF 文件（最大 20 MB）
- 文件存储在 Vercel Blob
- 文件列表展示名称、大小、上传时间
- 支持删除文件

## 数据库 Schema

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 关联 Agent |
| name | text | 文件名（同 Agent 内唯一） |
| url | text | Vercel Blob 公共 URL |
| size | integer | 文件大小（字节） |
| contentType | text | MIME 类型 |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents/[id]/files` | 列出所有文件 |
| POST | `/api/agents/[id]/files` | 上传文件（multipart/form-data） |
| DELETE | `/api/agents/[id]/files/[fileId]` | 删除文件 |
