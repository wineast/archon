# 功能树

## 基础设施

- [ ] **本地 Docker 开发数据库** — 用 Docker PostgreSQL 替代 Neon 云数据库，省钱低延迟
  - 工作区: `local-docker-db` | 分支: `dev-local-docker-db-20260217`

## 数据模型

- [ ] **统一 JSON 数据模型** — 将码表、对象、模板变量统一为分层 JSON：底层原子值无模板语法，上层可引用底层并使用模板
  - 工作区: `simplify-json-model` | 分支: `dev-simplify-json-model-20260217`
- [ ] **数据集自动依赖解析** — 去掉 layer 分层，扫描 Liquid 模板变量自动构建依赖图，Kahn 拓扑排序渲染，保存时检测循环
  - 工作区: `dataset-auto-deps` | 分支: `dev-dataset-auto-deps-20260218`

## Agent 配置

### Wiki

- [ ] **Wiki 移除独立 title** — 标题从 meta.title 获取，若无则 fallback 到内容开头
  - 工作区: `wiki-no-title` | 分支: `dev-wiki-no-title-20260217`

## 前端渲染

- [ ] **动态组件系统** — 参考工具 handler 机制，UI 组件改为数据库驱动的动态渲染，不依赖本地静态代码
  - 工作区: `dynamic-components` | 分支: `dev-dynamic-components-20260217`

## 用户与权限

- [ ] **用户权限系统** — 平台角色 + Agent 四级角色 + 成员管理 + 公开私有模式 + 聊天记录可见性
  - 工作区: `user-permissions` | 分支: `dev-user-permissions-20260217`
  - 详见 [guide/user-permissions.md](../guide/user-permissions.md)
