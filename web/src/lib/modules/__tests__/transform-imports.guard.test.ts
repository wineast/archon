/**
 * 缺陷守护：transformImports 必须将所有 import（含多行格式）正确转换，不残留原始 import 语句
 *
 * 守护目标：多行 import 经预处理合并为单行后，逐行正则可正常匹配，不传入 new Function()
 * 故障机制：source.split("\n") 逐行处理，多行 import 第一行 `import {` 不含 `from` → 不匹配 → 原样保留 → SyntaxError
 *
 * @see .worktree/DEFECT.md
 * @see .worktree/FIX_REPORT.md
 * @see .worktree/VERIFY_REPORT.md
 */
import { describe, it, expect } from "vitest";
import { transformImports } from "../transform-imports";

describe("Guard: 多行 import 不可残留原始 import 语句", () => {
  // ── Trigger Scenario + Cause Anchor ──

  describe("Cause Anchor: 多行 import 逐行处理故障机制", () => {
    it("多行 archon 命名 import → 转为 __deps__ 查找，无残留 import", () => {
      const source = `import {
  WrenchIcon,
  CheckCircleIcon,
  ClockIcon,
} from "archon:icons";
export default function() { return null; }`;
      const { code, modules } = transformImports(source);

      // Invariant: 不含原始 import
      expect(code).not.toContain("import");
      // 正确转换
      expect(code).toContain('__deps__["archon:icons"]');
      expect(code).toContain("WrenchIcon");
      expect(code).toContain("CheckCircleIcon");
      expect(code).toContain("ClockIcon");
      expect(modules.has("archon:icons")).toBe(true);
    });

    it("多行 import 的输出可被 new Function() 执行（无 SyntaxError）", () => {
      const source = `import {
  WrenchIcon,
  CheckCircleIcon,
} from "archon:icons";
export default function({ tool }) { return null; }`;
      const { code } = transformImports(source);

      // 核心断言：转换后的代码可被 new Function 执行，不抛 SyntaxError
      expect(() => new Function("__deps__", code)).not.toThrow();
    });
  });

  // ── Boundary Set ──

  describe("Boundary: 多行 import 边界变体", () => {
    it("Boundary-1: 多行 import type 被完整剥离", () => {
      const source = `import type {
  ToolProps,
  ComponentProps,
} from "archon:react";
import { useState } from "archon:react";
export default function() { return null; }`;
      const { code } = transformImports(source);

      expect(code).not.toContain("ToolProps");
      expect(code).not.toContain("ComponentProps");
      expect(code).not.toContain("import");
      expect(code).toContain('__deps__["archon:react"]');
    });

    it("Boundary-2: 超长多行 import（10+ 命名导出）", () => {
      const source = `import {
  WrenchIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  CircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FileTextIcon,
  AlertTriangleIcon,
  SettingsIcon,
  SearchIcon,
  PlusIcon,
} from "archon:icons";
export default function() { return null; }`;
      const { code, modules } = transformImports(source);

      expect(code).not.toContain("import");
      expect(code).toContain('__deps__["archon:icons"]');
      // 所有 12 个 icon 都在输出中
      for (const icon of [
        "WrenchIcon", "CheckCircleIcon", "ClockIcon", "XCircleIcon",
        "CircleIcon", "ChevronDownIcon", "ChevronUpIcon", "FileTextIcon",
        "AlertTriangleIcon", "SettingsIcon", "SearchIcon", "PlusIcon",
      ]) {
        expect(code).toContain(icon);
      }
      expect(modules.has("archon:icons")).toBe(true);
    });

    it("Boundary-3: 多行 import 含 as 重命名", () => {
      const source = `import {
  Badge as MyBadge,
  Table as DataTable,
} from "archon:ui";
export default function() { return null; }`;
      const { code, modules } = transformImports(source);

      expect(code).not.toContain("import");
      expect(code).toContain("Badge: MyBadge");
      expect(code).toContain("Table: DataTable");
      expect(code).toContain('__deps__["archon:ui"]');
      expect(modules.has("archon:ui")).toBe(true);
    });

    it("Boundary-4: 多行 import 无尾逗号", () => {
      const source = `import {
  WrenchIcon,
  CheckCircleIcon
} from "archon:icons";
export default function() { return null; }`;
      const { code, modules } = transformImports(source);

      expect(code).not.toContain("import");
      expect(code).toContain("WrenchIcon");
      expect(code).toContain("CheckCircleIcon");
      expect(modules.has("archon:icons")).toBe(true);
    });

    it("Boundary-5: 残缺多行 import（缺 from）不崩溃", () => {
      // 恶意/截断的 import，joinMultilineImports 应 flush as-is
      const source = `import {
  WrenchIcon,
  CheckCircleIcon,
`;
      // 不应抛异常
      expect(() => transformImports(source)).not.toThrow();
    });

    it("Boundary-6: 真实 tool-call-default 组件的 import 格式", () => {
      // 精确复现内置 tool-call-default 组件的 import 格式
      const source = `import {
  WrenchIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  CircleIcon,
  ChevronDownIcon,
} from "archon:icons";
import { Badge } from "archon:ui";
import { useState } from "archon:react";

export default function ToolCallDefault({ tool }) {
  const [expanded, setExpanded] = useState(false);
  return null;
}`;
      const { code, modules } = transformImports(source);

      // 不含任何残留 import
      expect(code).not.toContain("import");
      // 三个模块全部正确引用
      expect(modules).toEqual(
        new Set(["archon:icons", "archon:ui", "archon:react"])
      );
      expect(code).toContain('__deps__["archon:icons"]');
      expect(code).toContain('__deps__["archon:ui"]');
      expect(code).toContain('__deps__["archon:react"]');
      // 转换后可被 new Function 执行
      expect(() => new Function("__deps__", code)).not.toThrow();
    });
  });

  // ── Blast Shield ──

  describe("Blast Shield: 修复不影响已有行为", () => {
    it("Blast-1: 单行+多行 import 混合共存，互不干扰", () => {
      const source = `import { useState } from "archon:react";
import { Badge } from "archon:ui";
import {
  WrenchIcon,
  CheckCircleIcon,
} from "archon:icons";
import ProductCard from "archon:component/product-card";

export default function({ tool }) {
  return null;
}`;
      const { code, modules } = transformImports(source);

      expect(code).not.toContain("import");
      expect(modules.size).toBe(4);
      expect(code).toContain('__deps__["archon:react"]');
      expect(code).toContain('__deps__["archon:ui"]');
      expect(code).toContain('__deps__["archon:icons"]');
      expect(code).toContain('__deps__["archon:component/product-card"]');
    });

    it("Blast-2: 多行 import 存在时 export default 转换不受影响", () => {
      const source = `import {
  WrenchIcon,
  ClockIcon,
} from "archon:icons";

export default function ToolUI({ tool }) {
  return null;
}`;
      const { code } = transformImports(source);

      // export default 被正确转换
      expect(code).toContain("var __default_export__ = function");
      expect(code).toContain("return __default_export__;");
      // 不含残留 export
      expect(code).not.toContain("export default");
    });
  });
});
