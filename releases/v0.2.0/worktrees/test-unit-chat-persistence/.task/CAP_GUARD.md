# 需求守护规约：Chat 持久化层单元测试

> 生成时间：2026-03-02 23:02
> 关联需求：[REQ.md](REQ.md)
> 关联实现：[IMPL_REPORT.md](IMPL_REPORT.md)
> 关联验收：[ACCEPT_REPORT.md](ACCEPT_REPORT.md)
> 分支：`dev-test-unit-chat-persistence-20260302`

## 1. Capability（能力宣言）

Chat 持久化层（`chat-persistence.ts`）的核心读写功能由自动化测试持续守护：session 创建幂等性、用户/AI 消息写入正确性、消息加载排序、并发写入原子性——任何回归在 `make test` 时立即暴露。

## 2. Criteria Matrix（标准矩阵）

| # | 验收标准 | Given | When | Then | Level | Test Case |
|---|----------|-------|------|------|-------|-----------|
| CM-1 | createSession 字段持久化 | 无 session | createSession({id, title, model, source}) | session 存在，字段一致，messageCount=0 | Unit | "creates a session with correct fields" |
| CM-2 | createSession 幂等 | session 已存在 | 同 id 再次 createSession | 返回 undefined，原记录不变 | Unit | "returns undefined on duplicate id" |
| CM-3 | createSession source 默认值 | 不传 source | createSession({id, title, model}) | source="chat" | Unit | "defaults source to 'chat'" |
| CM-4 | saveMessage(user) 写入+content | session 存在 | saveMessage(role=user, parts=[text]) | 消息可查，content=text | Unit | "saves a user message with text parts" |
| CM-5 | saveMessage(user) 多 text 拼接 | session 存在 | saveMessage(parts=[text1, text2]) | content="text1\ntext2" | Unit | "joins multiple text parts with newline" |
| CM-6 | saveMessage(user) messageCount | session.messageCount=0 | saveMessage ×2 | messageCount=1, 2 | Unit | "increments session messageCount" (user) |
| CM-7 | saveMessage(assistant) tool parts | session 存在 | saveMessage(role=assistant, parts=[text, tool]) | parts 完整存储，content 仅 text | Unit | "saves assistant message with tool parts" |
| CM-8 | saveMessage(assistant) 无 text | session 存在 | saveMessage(parts=[tool]) | content=null | Unit | "sets content to null when no text parts" |
| CM-9 | saveMessage(assistant) messageCount | session.messageCount=0 | saveMessage(assistant) ×1 | messageCount=1 | Unit | "increments session messageCount" (assistant) |
| CM-10 | getSessionMessages 排序 | session 有 3 条消息 | getSessionMessages(sessionId) | 按 createdAt 升序返回 | Unit | "returns messages ordered by createdAt" |
| CM-11 | getSessionMessages 空 | session 无消息 | getSessionMessages(sessionId) | 返回 [] | Unit | "returns empty array for session with no messages" |
| CM-12 | getSessionMessages 隔离 | 两个 session 各有消息 | getSessionMessages(sessionA) | 只返回 sessionA 的消息 | Unit | "does not return messages from other sessions" |
| CM-13 | 并发安全 messageCount | session.messageCount=0 | 10 并发 saveMessage | messageCount=10，消息数=10 | Unit | "messageCount is correct after N concurrent" |

## 3. Journey Test（旅程测试）

### Journey 1: Chat 持久化完整生命周期
- **Who**: 开发者（通过测试间接模拟 Chat 流程）
- **Level**: Unit（DB 集成）
- **Flow**:
  1. createSession 创建新 session
  2. saveMessage(user) 写入用户消息
  3. saveMessage(assistant) 写入 AI 响应
  4. getSessionMessages 加载完整对话历史
  5. 验证消息顺序、内容、计数全部正确
- **覆盖**: 测试 "increments session messageCount"(user) 已隐含此旅程——创建 session → 连续写入 → 查询验证

**注**：由于本任务是 DB 层单元测试（非 UI 功能），不适合 E2E Journey Test。旅程通过测试用例的 arrange-act-assert 链条隐式覆盖。

## 4. Constraint Guard（约束守卫）

| # | 约束 | Given | When | Then | Level | Test Case |
|---|------|-------|------|------|-------|-----------|
| CG-1 | onConflictDoNothing 语义 | session 已存在 | 重复 createSession | 不抛错，不覆盖 | Unit | CM-2 |
| CG-2 | SQL +1 原子递增 | session.messageCount=0 | 10 并发 saveMessage | messageCount=10（非 9 或 11） | Unit | CM-13 |
| CG-3 | extractTextContent 只提取 text | parts 含 text + tool | saveMessage | content 只含 text 部分 | Unit | CM-7, CM-8 |

## 5. Degradation Fence（退化围栏）

| # | Known Gap | 底线 | 测试覆盖 |
|---|-----------|------|----------|
| DF-1 | 并发 N=10 非高并发压测 | N=10 的原子性必须持续工作 | CM-13 |
| DF-2 | 依赖外部 DB 运行 | DB 可用时所有测试必须通过 | 全部 13 个测试 |

## 6. Coverage Matrix（覆盖矩阵）

| 来源 | 测试用例 | 文件 | 层级 | 状态 |
|------|----------|------|------|------|
| CM-1 | creates a session with correct fields | chat-persistence.test.ts | Unit | ✅ |
| CM-2 | returns undefined on duplicate id | chat-persistence.test.ts | Unit | ✅ |
| CM-3 | defaults source to 'chat' | chat-persistence.test.ts | Unit | ✅ |
| CM-4 | saves a user message with text parts | chat-persistence.test.ts | Unit | ✅ |
| CM-5 | joins multiple text parts with newline | chat-persistence.test.ts | Unit | ✅ |
| CM-6 | increments session messageCount (user) | chat-persistence.test.ts | Unit | ✅ |
| CM-7 | saves assistant message with tool parts | chat-persistence.test.ts | Unit | ✅ |
| CM-8 | sets content to null when no text parts | chat-persistence.test.ts | Unit | ✅ |
| CM-9 | increments session messageCount (assistant) | chat-persistence.test.ts | Unit | ✅ |
| CM-10 | returns messages ordered by createdAt | chat-persistence.test.ts | Unit | ✅ |
| CM-11 | returns empty array for session with no messages | chat-persistence.test.ts | Unit | ✅ |
| CM-12 | does not return messages from other sessions | chat-persistence.test.ts | Unit | ✅ |
| CM-13 | messageCount is correct after N concurrent | chat-persistence.test.ts | Unit | ✅ |
| Journey-1 | (隐含于 CM-6 的 arrange-act-assert 链) | chat-persistence.test.ts | Unit | ✅ |
| CG-1 | (同 CM-2) | chat-persistence.test.ts | Unit | ✅ |
| CG-2 | (同 CM-13) | chat-persistence.test.ts | Unit | ✅ |
| CG-3 | (同 CM-7 + CM-8) | chat-persistence.test.ts | Unit | ✅ |
| DF-1 | (同 CM-13) | chat-persistence.test.ts | Unit | ✅ |
| DF-2 | (全部 13 个测试) | chat-persistence.test.ts | Unit | ✅ |
