# 测试守护报告：版本操作接口 versionId 归属校验（防 IDOR 越权）

> 执行时间：2026-03-01
> 关联规约：[TEST_GUARD.md](TEST_GUARD.md)
> 分支：`dev-version-publish-missing-agent-ownership-check-20260301`

## 1. 规约概要

### Invariant
所有版本操作 API 的 version 查询 WHERE 子句必须包含 `agentVersions.agentId` 条件，使用 `and()` 组合多条件，确保 versionId 必须属于路径中的 agentId。

### 覆盖统计
| 元素 | 规约数 | 测试数 | 通过 | 失败 |
|------|--------|--------|------|------|
| Cause Anchor | 2 | 8 | 8 | 0 |
| Trigger Scenario | 1 | 1 | 1 | 0 |
| Boundary Set | 1 | 1 | 1 | 0 |
| Blast Shield | 2 | 2 | 2 | 0 |

## 2. 测试结果

### 静态检查
- `make typecheck`：通过
- `make test`：通过（114 文件 / 1296 用例）

### 单元测试
| 文件 | 用例数 | 通过 | 失败 | 覆盖规约 |
|------|--------|------|------|----------|
| `src/app/api/agents/[id]/versions/__tests__/ownership.guard.test.ts` | 12 | 12 | 0 | Cause Anchor, Trigger Scenario, Boundary, Blast Shield |

## 3. Coverage Matrix（覆盖矩阵）

| 守护元素 | 测试用例 | 文件 | 层级 | 结果 |
|---------|---------|------|------|------|
| Cause Anchor | POST publish — 源码包含 agentVersions.agentId | ownership.guard.test.ts | Unit | ✅ |
| Cause Anchor | POST publish — 源码 import and() | ownership.guard.test.ts | Unit | ✅ |
| Cause Anchor | POST rollback — 源码包含 agentVersions.agentId | ownership.guard.test.ts | Unit | ✅ |
| Cause Anchor | POST rollback — 源码 import and() | ownership.guard.test.ts | Unit | ✅ |
| Cause Anchor | GET/DELETE [versionId] — 源码包含 agentVersions.agentId | ownership.guard.test.ts | Unit | ✅ |
| Cause Anchor | GET/DELETE [versionId] — 源码 import and() | ownership.guard.test.ts | Unit | ✅ |
| Cause Anchor | POST switch — 源码包含 agentVersions.agentId | ownership.guard.test.ts | Unit | ✅ |
| Cause Anchor | POST switch — 源码 import and() | ownership.guard.test.ts | Unit | ✅ |
| Trigger Scenario | 跨 agent versionId → 404 | ownership.guard.test.ts | Unit | ✅ |
| Blast Shield | 同 agent versionId → 200 | ownership.guard.test.ts | Unit | ✅ |
| Boundary | DELETE 的 WHERE 包含 agentId（≥2 处） | ownership.guard.test.ts | Unit | ✅ |
| Blast Shield | 版本列表接口保持正确 agentId 过滤 | ownership.guard.test.ts | Unit | ✅ |

## 4. Verdict（裁定）

### 判决
✅ 守护就绪

### 证据摘要
- **Cause Anchor**：8 条源码断言覆盖 4 个路由文件的 `agentVersions.agentId` 条件和 `and()` 导入
- **Trigger Scenario**：publish 越权路径 → 404（mock DB 验证行为）
- **Boundary Set**：DELETE 双处 agentId 校验（GET + DELETE 各一处）
- **Blast Shield**：publish 正常路径 → 200；版本列表接口保持 agentId 过滤

### 未覆盖项
无。

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
| `web/src/app/api/agents/[id]/versions/__tests__/ownership.guard.test.ts` | Unit | 12 |

## 过程备注

[重试] 首次 typecheck 失败因 `Request` 类型不兼容 `NextRequest`，改为 `new NextRequest()` 后通过。
[确认] `diff-guard.test.ts` 在全量运行中偶现 flaky（单独运行通过），与本次修改无关。二次全量运行 114/114 通过。
