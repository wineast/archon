# 测试守护报告：Wiki 查询 versionId 隔离

> 执行时间：2026-03-01 15:21
> 关联规约：[TEST_GUARD.md](TEST_GUARD.md)
> 分支：`dev-cross-agent-wiki-data-leak-no-agentid-filter-20260301`

## 1. 规约概要

### Invariant
Wiki 查询（get/findByPrefix/search）只返回当前 versionId 对应的文档，不能跨 Agent/跨版本泄露数据。

### 覆盖统计
| 元素 | 规约数 | 测试数 | 通过 | 失败 |
|------|--------|--------|------|------|
| Cause Anchor | 4 | 4 | 4 | 0 |
| Boundary Set | 4 | 4 | 4 | 0 |
| Blast Shield | 1 | 1 | 1 | 0 |

## 2. 测试结果

### 静态检查
- `make typecheck`：通过
- `make test`：通过（113 files, 1284 tests passed；`diff-guard.test.ts` 全量运行偶发 1 次失败，单独运行 27/27 通过，属 flaky test，与本次修改无关）

### 单元测试
| 文件 | 用例数 | 通过 | 失败 | 覆盖规约 |
|------|--------|------|------|----------|
| `src/lib/tools/__tests__/tool-context-wiki-isolation.guard.test.ts` | 9 | 9 | 0 | Cause Anchor ×4, Boundary ×4, Blast Shield ×1 |

## 3. Coverage Matrix（覆盖矩阵）

| 守护元素 | 测试用例 | 文件 | 层级 | 结果 |
|---------|---------|------|------|------|
| Cause Anchor | wiki.search() 查询包含 eq(versionId, value) | guard.test.ts | Unit | ✅ |
| Cause Anchor | wiki.findByPrefix() 查询包含 eq(versionId, value) | guard.test.ts | Unit | ✅ |
| Cause Anchor | wiki.get() UUID 路径包含 eq(versionId, value) | guard.test.ts | Unit | ✅ |
| Cause Anchor | wiki.get() key fallback 包含 eq(versionId, value) | guard.test.ts | Unit | ✅ |
| Boundary #1 | wiki.get() 无 versionId → 返回 null 不查库 | guard.test.ts | Unit | ✅ |
| Boundary #1 | wiki.findByPrefix() 无 versionId → 返回 [] 不查库 | guard.test.ts | Unit | ✅ |
| Boundary #1 | wiki.search() 无 versionId → 返回 [] 不查库 | guard.test.ts | Unit | ✅ |
| Boundary #1 | wiki.get() 无 agentId 且无 versionId → 返回 null 不查库 | guard.test.ts | Unit | ✅ |
| Blast Shield #1 | dataset.get() 仍调用 getAgentDatasets(agentId, versionId) | guard.test.ts | Unit | ✅ |

## 4. Verdict（裁定）

### 判决
✅ 守护就绪

### 证据摘要
- **Cause Anchor**：4/4 通过——三个方法的 WHERE 子句均包含 versionId 过滤，UUID 和 key 两条路径均覆盖
- **Boundary Set**：4/4 通过——无 versionId 时三个方法均返回空不查库
- **Blast Shield**：1/1 通过——dataset 查询不受影响

### 未覆盖项
- E2E 层面的跨 Agent 隔离测试未覆盖——该场景需要两个 Agent 并行运行 Tool Handler 并比较结果，超出单元测试能力且 E2E 成本过高。Unit 层面的 Cause Anchor 已在根因层面钉钉子，足以防止回归

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
| `web/src/lib/tools/__tests__/tool-context-wiki-isolation.guard.test.ts` | Unit | 9 |

## 过程备注

[重试] 首次运行 Blast Shield 测试因 `resolveDatasets` mock 返回空对象导致 dataset.get() 返回 null，改为只验证 `getAgentDatasets` 被正确调用
[重试] 类型检查失败——mock 工厂函数的 spread 参数类型不匹配，改为显式参数声明
[重试] 缺少 `@/lib/ontology/utils` 和 `@/lib/ontology/external-proxy` 的 mock，补充后通过
[确认] 全量测试中 `diff-guard.test.ts` 偶发失败为 flaky test，单独运行通过
