---
name: ports
description: 查看当前工作区的服务端口号和访问地址。当用户询问"端口号"、"端口是多少"、"服务地址"、"怎么访问"，或执行 make up 完成后，调用此技能。
allowed-tools: Bash, Read
---

查看当前工作区的服务端口和访问地址。

## 操作流程

1. 读取 `.worktree/meta.json` 获取端口配置
2. 按以下格式返回：

```
| 服务       | 端口  | 地址                                          |
|------------|-------|-----------------------------------------------|
| Dev        | {dev} | http://localhost:{dev}                         |
| Storybook  | {sb}  | http://localhost:{sb}                          |
| Studio     | {studio} | https://local.drizzle.studio?port={studio}  |
| PostgreSQL | 5432  | postgresql://archon:archon@localhost:5432/{db} |
```

其中 `{db}` 根据工作区类型决定：
- 主仓库：`archon_archon`
- worktree：`archon_<name>`（name = 工作区目录名，`-` 替换为 `_`）

## 注意事项

- 如果 `.worktree/meta.json` 不存在，说明还没执行 `make setup`，提示用户先执行
- Studio 的浏览器访问地址是 `https://local.drizzle.studio?port={studio}`，**不是** `https://local.drizzle.studio:{studio}`
