# 测试守护报告：测试端点授权 + Code Scanner fail-closed

> 执行时间：2026-03-01 21:35
> 关联规约：[TEST_GUARD.md](TEST_GUARD.md)
> 分支：`dev-unauthenticated-code-execution-test-endpoints-20260301`

## 1. 规约概要

### Invariant
工具/函数测试端点必须验证 Agent editor 权限后才执行代码；Code Scanner 必须拒绝无法解析的代码。

### 覆盖统计
| 元素 | 规约数 | 测试数 | 通过 | 失败 |
|------|--------|--------|------|------|
| Trigger Scenario | 2 | 2 | 2 | 0 |
| Cause Anchor | 3 | 3 | 3 | 0 |
| Boundary Set | 6 | 10 | 10 | 0 |
| Blast Shield | 3 | 3 | 3 | 0 |

## 2. 测试结果

### 静态检查
- `make typecheck`：通过
- `make test`：115 passed / 1 failed（pre-existing，与本次修改无关）

### 单元/集成测试
| 文件 | 用例数 | 通过 | 失败 | 覆盖规约 |
|------|--------|------|------|----------|
| `src/app/api/tools/test/__tests__/auth.guard.test.ts` | 8 | 8 | 0 | Cause Anchor 2a, Trigger A, Boundary 1-6 |
| `src/app/api/functions/test/__tests__/auth.guard.test.ts` | 8 | 8 | 0 | Cause Anchor 2b, Trigger B, Boundary 1-6 |
| `src/lib/__tests__/code-scanner.test.ts` (已有) | 14 | 14 | 0 | Cause Anchor 1, Blast Shield 1 |
| `src/lib/tools/__tests__/execute-handler.test.ts` (已有) | 6 | 6 | 0 | Blast Shield 2 |
| `src/lib/functions/__tests__/exec.test.ts` (已有) | 24 | 24 | 0 | Blast Shield 3 |

## 3. Coverage Matrix（覆盖矩阵）

| 守护元素 | 测试用例 | 文件 | 层级 | 结果 |
|---------|---------|------|------|------|
| Trigger A | 缺少 agentId → 400 | auth.guard.test.ts (tools) | Integration | ✅ |
| Trigger B | 缺少 agentId → 400 | auth.guard.test.ts (functions) | Integration | ✅ |
| Cause Anchor 1 | rejects code with syntax errors | code-scanner.test.ts | Unit | ✅ |
| Cause Anchor 2a | 授权返回 403 时不调用 executeToolHandler | auth.guard.test.ts (tools) | Integration | ✅ |
| Cause Anchor 2b | 授权返回 403 时不调用 compileAndExecFn | auth.guard.test.ts (functions) | Integration | ✅ |
| Boundary 1 | 缺少 agentId → 400 | 两个 auth.guard.test.ts | Integration | ✅ |
| Boundary 2 | agentId 为 number → 400 | 两个 auth.guard.test.ts | Integration | ✅ |
| Boundary 3 | requireAgentRole 返回 403 | 两个 auth.guard.test.ts | Integration | ✅ |
| Boundary 4 | requireAgentRole 返回 401 | 两个 auth.guard.test.ts | Integration | ✅ |
| Boundary 5 | 授权通过但缺 handler/code → 400 | 两个 auth.guard.test.ts | Integration | ✅ |
| Boundary 6 | 授权通过且完整 → 正常执行 | 两个 auth.guard.test.ts | Integration | ✅ |
| Blast Shield 1 | passes clean code | code-scanner.test.ts | Unit | ✅ |
| Blast Shield 2 | evaluates numeric computation | execute-handler.test.ts | Unit | ✅ |
| Blast Shield 3 | evaluates numeric computation | exec.test.ts | Unit | ✅ |

## 4. Verdict（裁定）

### 判决
✅ 守护就绪

### 证据摘要
- **Trigger Scenario**：2/2 通过——缺少 agentId 时两个端点都返回 400，代码不执行
- **Cause Anchor**：3/3 通过——scanner 拒绝语法错误代码 + 两个端点在授权失败时不调用执行函数
- **Boundary Set**：10/10 通过——6 个边界变体在两个端点上全部正确
- **Blast Shield**：3/3 通过——正常代码的扫描和执行不受影响

### 未覆盖项
无。所有规约条目都有对应测试覆盖。

### Traceability（追溯）
```
origin: DEFECT.md
fixed_by: FIX_REPORT.md
verified_by: VERIFY_REPORT.md
guarded_by: TEST_GUARD.md + 本报告
```

### 新增测试文件
| 文件 | 类型 | 用例数 |
|------|------|--------|
| `web/src/app/api/tools/test/__tests__/auth.guard.test.ts` | Integration | 8 |
| `web/src/app/api/functions/test/__tests__/auth.guard.test.ts` | Integration | 8 |

## 过程备注

- [绕路] 首次运行时 import 路径 `../../route` 错误解析到了 `/api/tools/route.ts` 而非 `/api/tools/test/route.ts`，修正为 `../route` 后通过
- [绕路] TypeScript 报类型不兼容（`NextRequest` vs `Request`），用 `any` 类型绕过测试辅助层的类型检查
- [确认] `diff-guard.test.ts` 的 1 个失败是 pre-existing issue，与本次修改无关（动态导入 route 模块时 DB 连接失败）
