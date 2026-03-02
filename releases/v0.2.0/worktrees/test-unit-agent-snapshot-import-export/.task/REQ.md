# 需求报告：Agent 导入导出与快照单元测试

> 创建时间：2026-03-02 20:00
> 分支：`dev-test-unit-agent-snapshot-import-export-20260302`

## 1. Who（主体 + 场景）

### 使用者
维护 Agent 导入导出功能的开发者。

### 使用场景
- 修改 snapshot.ts / copy-resources.ts / import route 后跑 `make test` 快速验证
- 新增资源类型时确认不破坏现有导入导出链路
- CI 中拦截回归——当前这三个模块无专门测试，修改全靠人肉复查

## 2. Why（动机）

### 痛点
三个核心模块合计 1600+ 行，涉及 19 个表的并行查询、14 步依赖顺序插入、多层 ID 映射链——逻辑密度高但测试覆盖为零。现有测试仅覆盖纯函数（validateExportData、migrateExportData、computeSnapshotDiff），不触及 DB 交互核心。

### 做了的价值
- 改动 snapshot/copy-resources 后 `make test` 几秒内反馈正确性
- 新增资源类型时有测试模板参考，降低遗漏概率
- 重构 ID 映射或依赖顺序时有安全网

### 不做的代价
每次触及导入导出逻辑都要手动全流程测试，慢且不可靠；潜在的 FK 顺序或映射错误只能在 E2E 或生产中暴露。

## 3. What（能力声明）

### 核心能力

三个测试文件，对应三个核心模块：

**A. `snapshot.test.ts`** — buildSnapshot + restoreSnapshot
- 验证 buildSnapshot 的并行查询→ID 映射→资源组装完整链路
- 验证 restoreSnapshot 的删除顺序→依赖插入→引用解析完整链路
- 覆盖关键边界：Agent 不存在抛异常、deletedAt 资源被过滤、池资源引用缺失时跳过、Wiki 两轮插入的 parentId 解析、组件引用两层查询回退

**B. `copy-resources.test.ts`** — copyVersionResources
- 验证 16 类资源的 ID 映射链完整性（oldId → newId）
- 验证 FK 依赖链边界：objectRelations 过滤无效引用、tools.componentId 池资源回退、测试用例跳过已删除父资源
- 验证资源引用直通复制（resourceId 不变、versionId 更新）

**C. `import-route.test.ts`** — POST /api/agents/import
- 验证参数校验（orgId/blobUrl 缺失 → 400）
- 验证权限检查（requireOrgRole 拒绝 → 返回对应响应）
- 验证 ZIP 解析失败→删除临时 blob→400
- 验证正常导入事务流程：Agent 创建 + 成员添加 + 多版本插入 + 快照恢复 + 嵌入令牌生成 + 文件恢复
- 验证版本标记回退（无 isEditing/isPublished 标记时用最后一个版本）
- 验证 ZIP 中文件缺失时跳过
- 验证临时 blob 清理

### 不做（Out of Scope）
- 不做 E2E 集成测试（已有 export-import.test.ts 覆盖端到端流程）
- 不做 export route 测试（本次聚焦 import 侧）
- 不测试 migrateExportData / validateExportData（已有测试）
- 不实际连接数据库——所有 DB 交互通过精准 Mock

## 4. Acceptance（验收标准）

### snapshot.test.ts

- [ ] buildSnapshot：正常路径——给定 agentId+versionId，mock 19 个并行查询返回值，验证输出 AgentSnapshot 结构包含所有资源类型且字段正确映射
- [ ] buildSnapshot：Agent 不存在——agent 查询返回 undefined，抛出 "Agent not found" 错误
- [ ] buildSnapshot：deletedAt 资源被过滤——mock 返回的资源中包含 deletedAt 非 null 的记录，验证快照中不包含
- [ ] buildSnapshot：池资源引用缺失——引用的池资源 key 查不到时，该引用被跳过（不在快照的 resourceRefs 中出现）
- [ ] restoreSnapshot：删除顺序——验证 objectRelations 在 objectTypes 之前删除（通过 mock 调用顺序断言）
- [ ] restoreSnapshot：Wiki 两轮插入——第一轮 parentId=null，第二轮根据 parentKey 更新
- [ ] restoreSnapshot：组件引用两层查询——先查本版本新插入的组件，查不到再查池（agentId IS NULL），都查不到设为 null
- [ ] restoreSnapshot：资源引用恢复——通过 key 查池资源 ID，使用 onConflictDoNothing 处理重复

### copy-resources.test.ts

- [ ] 正常路径——16 类资源全部从 sourceVersionId 复制到 targetVersionId，新 ID 不同于旧 ID
- [ ] objectRelations 过滤——sourceTypeId 或 targetTypeId 不在 objTypeIdMap 中时，该关系被跳过
- [ ] tools.componentId 回退——componentId 不在 compIdMap 中时保留原 ID（池资源）
- [ ] 测试用例过滤——父资源（tool/function/component）被删除时，其测试用例不复制
- [ ] 资源引用直通——resourceId 不变，仅 versionId 更新为 targetVersionId

### import-route.test.ts

- [ ] orgId 缺失返回 400
- [ ] blobUrl 缺失或非字符串返回 400
- [ ] requireOrgRole 返回 NextResponse 时直接透传
- [ ] ZIP 解析失败：删除临时 blob + 返回 400
- [ ] 正常导入：Agent 创建 + agentMembers 插入 + 版本插入 + restoreSnapshot 调用 + 嵌入令牌生成（et_ 前缀）+ 文件恢复到 Vercel Blob
- [ ] 版本标记回退：无 isEditing 标记时使用最后一个版本 ID
- [ ] ZIP 文件缺失：zipEntry 为 null 时跳过该文件
- [ ] 临时 blob 在成功和失败路径都被清理
- [ ] 所有测试通过 `make test`

## 5. Constraint（约束）

### 技术约束
- 测试框架：Vitest（项目已有配置）
- Mock 模式：精准 Mock db 模块 + 查询序列数组，参考 `create-run.test.ts` 的链式 mock 模式
- 文件位置：`web/src/lib/versions/__tests__/snapshot.test.ts`、`copy-resources.test.ts`；`web/src/app/api/agents/import/__tests__/import-route.test.ts`
- 不引入新依赖
- mock drizzle-orm 操作符（eq、and、isNull 等）
- mock @/db 模块，不实际连接数据库

### 不可打破的现有行为
- 不修改被测代码（snapshot.ts、copy-resources.ts、route.ts）
- 不修改现有测试文件
- 现有 `make test` 全部通过

## 参考

- 被测文件：`web/src/lib/versions/snapshot.ts`（808 行）、`web/src/lib/versions/copy-resources.ts`（600 行）、`web/src/app/api/agents/import/route.ts`（221 行）
- 现有测试参考：`web/src/app/api/eval/run/__tests__/create-run.test.ts`（DB mock 最佳实践）
- 现有快照测试：`web/src/lib/versions/__tests__/snapshot-resource-refs.test.ts`、`snapshot-component-types.test.ts`
- Fixture：`web/src/lib/versions/__tests__/fixtures/wiki-agent.json`

## 过程备注

[确认] 用户选择精准 Mock 策略 + Route 完整覆盖，而非最小可用或跳过 route。
