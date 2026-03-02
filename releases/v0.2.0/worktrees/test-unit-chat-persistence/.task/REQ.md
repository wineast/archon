# 需求报告：Chat 持久化层单元测试

> 创建时间：2026-03-02 22:30
> 分支：`dev-test-unit-chat-persistence-20260302`

## 1. Who（主体 + 场景）

### 使用者
维护 Chat 持久化层的开发者。

### 使用场景
修改 `chat-persistence.ts` 后需要快速验证核心读写逻辑未被破坏。当前该模块 13 个 DB 函数零测试覆盖，纯函数 `responseMessagesToUIParts` 已有完整测试。

## 2. Why（动机）

### 痛点
`chat-persistence.ts`（8KB）是消息不丢失的保障层，承担 session 创建、用户消息写入、AI 响应写入、历史消息加载等核心职责。当前无任何 DB 层测试，修改时只能靠 E2E 或手动验证。

### 做了的价值
- 修改持久化逻辑后秒级回归验证
- 覆盖 `onConflictDoNothing` 幂等性、`messageCount` 原子递增等 SQL 语义
- 并发写入安全性有断言保障

### 不做的代价
持久化层回归只能靠 E2E（慢）或人肉测试（不可靠），消息丢失 bug 可能悄悄引入。

## 3. What（能力声明）

### 核心能力

为 `web/src/db/chat-persistence.ts` 的以下 4 个函数编写单元测试：

1. **createSession** — 验证 session 创建、字段持久化、`onConflictDoNothing` 幂等性
2. **saveMessage (role=user)** — 验证用户消息写入、`parts` → `content` 提取、`messageCount` 递增
3. **saveMessage (role=assistant)** — 验证 AI 响应消息写入（含 tool parts）、content 提取、messageCount 递增
4. **getSessionMessages** — 验证按 sessionId 加载、按 createdAt 排序、空 session 返回空数组

5. **并发写入安全性** — 多个 `saveMessage` 并发调用时 `messageCount` 最终一致（SQL `+ 1` 原子性）

### 不做（Out of Scope）
- 其他 DB 函数（updateSessionTitle、deleteSession、share 系列、importSession 等）
- `responseMessagesToUIParts` 已有测试，不重复
- `extractTextContent` 作为 `saveMessage` 的内部依赖间接覆盖，不单独测试

## 4. Acceptance（验收标准）

- [ ] 测试文件 `web/src/db/__tests__/chat-persistence.test.ts` 存在
- [ ] `createSession`：创建 session 后可通过 DB 查询到，字段（title、model、source）与入参一致
- [ ] `createSession` 幂等：同 id 重复调用不抛错，不产生重复行
- [ ] `saveMessage` (user)：写入后可查到，role="user"，parts 与入参一致，content 为 parts 中 text 的拼接
- [ ] `saveMessage` (assistant)：写入含 tool-call parts 的消息，content 仅提取 text 部分
- [ ] `saveMessage` 递增 messageCount：每次保存后 session.messageCount 正确递增
- [ ] `getSessionMessages`：返回结果按 createdAt 升序排列
- [ ] `getSessionMessages`：session 无消息时返回空数组
- [ ] 并发安全：N 个 `saveMessage` 并发执行后，session.messageCount === N
- [ ] 测试使用真实 PG 连接，沿用 `seed-idempotency.test.ts` 的连接模式
- [ ] `make test` 全部通过
- [ ] `make typecheck` 无报错

## 5. Constraint（约束）

### 业务约束
- 不触及生产数据库，仅使用本地开发库

### 技术约束
- 测试框架：Vitest（项目统一）
- DB 连接：沿用 `dotenv` + `DATABASE_URL` 模式，直接连接真实 PG
- 测试文件放在 `web/src/db/__tests__/` 目录，与现有测试一致
- 每个测试用例需做好数据隔离（使用随机 id / nanoid），测试后清理或依赖 cascade

### 不可打破的现有行为
- `onConflictDoNothing` 语义：重复 session id 不抛错
- `messageCount` 使用 SQL `+ 1` 递增（非应用层计数）
- `extractTextContent` 只提取 `type: "text"` 的 parts

## 参考
- 锚点文件：`web/src/db/chat-persistence.ts`
- Schema：`web/src/db/schema.ts` L225-257（chatSessions）、L526-550（messages）
- 现有 DB 测试模式：`web/src/db/__tests__/seed-idempotency.test.ts`
- 现有纯函数测试：`web/src/db/__tests__/response-messages-to-ui-parts.test.ts`

## 过程备注

[确认] 用户选择严格 TASK.md 范围 + 真实 DB 连接模式
