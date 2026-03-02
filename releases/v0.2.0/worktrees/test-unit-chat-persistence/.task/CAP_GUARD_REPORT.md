# 需求守护报告：Chat 持久化层单元测试

> 执行时间：2026-03-02 23:03
> 关联规约：[CAP_GUARD.md](CAP_GUARD.md)
> 分支：`dev-test-unit-chat-persistence-20260302`

## 1. 规约概要

### Capability
Chat 持久化层核心读写功能由 13 个自动化测试持续守护，覆盖 session 创建幂等性、消息写入正确性、加载排序、并发原子性。

### 覆盖统计
| 元素 | 规约数 | 测试数 | 通过 | 失败 |
|------|--------|--------|------|------|
| Criteria Matrix | 13 | 13 | 13 | 0 |
| Journey Test | 1 | 1（隐含） | 1 | 0 |
| Constraint Guard | 3 | 3（复用） | 3 | 0 |
| Degradation Fence | 2 | 2（复用） | 2 | 0 |

## 2. 测试结果

### 静态检查
- `make typecheck`：通过
- `make test`：116/117 文件通过，1324/1325 用例通过（1 个预先存在失败）

### 单元测试
| 文件 | 用例数 | 通过 | 失败 | 覆盖规约 |
|------|--------|------|------|----------|
| `web/src/db/__tests__/chat-persistence.test.ts` | 13 | 13 | 0 | CM-1~13, Journey-1, CG-1~3, DF-1~2 |

### E2E 测试
不适用。本任务为 DB 层单元测试，无 UI 交互。

## 3. Coverage Matrix（覆盖矩阵）

| 来源 | 测试用例 | 文件 | 层级 | 结果 |
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
| CM-13 | messageCount correct after N concurrent | chat-persistence.test.ts | Unit | ✅ |
| Journey-1 | 隐含于 CM-6 arrange-act-assert 链 | chat-persistence.test.ts | Unit | ✅ |
| CG-1 | 同 CM-2 | chat-persistence.test.ts | Unit | ✅ |
| CG-2 | 同 CM-13 | chat-persistence.test.ts | Unit | ✅ |
| CG-3 | 同 CM-7 + CM-8 | chat-persistence.test.ts | Unit | ✅ |
| DF-1 | 同 CM-13 | chat-persistence.test.ts | Unit | ✅ |
| DF-2 | 全部 13 个测试 | chat-persistence.test.ts | Unit | ✅ |

## 4. Verdict（裁定）

### 判决
✅ **守护就绪**

### 证据摘要
- **Criteria Matrix**：13/13 条全覆盖，全部通过
- **Journey Test**：1 个旅程隐含覆盖，通过
- **Constraint Guard**：3/3 条覆盖（复用 Criteria 测试），通过
- **Degradation Fence**：2/2 条覆盖（复用 Criteria 测试），通过

### 未覆盖项
无。本任务实现产物即守护产物，覆盖矩阵 100% 闭合。

### 新增测试文件
| 文件 | 类型 | 用例数 |
|------|------|--------|
| `web/src/db/__tests__/chat-persistence.test.ts` | Unit (DB Integration) | 13 |

## 过程备注

[绕路] 本任务的特殊性：实现本身即测试代码，守护规约映射已有测试而非编写新测试。传统需求链路中守护是"为实现写测试"，本任务中实现和守护合一。
