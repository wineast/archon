import { describe, it, expect } from "vitest";
import { transformImports } from "../transform-imports";

describe("transformImports", () => {
  it("transforms default import", () => {
    const source = `import ProductCard from "archon:component/product-card";
export default function({ tool }) {
  return <ProductCard tool={tool} />;
}`;
    const { code, modules } = transformImports(source);
    expect(code).toContain(
      'const ProductCard = __deps__["archon:component/product-card"].default;'
    );
    expect(code).toContain("var __default_export__ = function");
    expect(code).toContain("return __default_export__;");
    expect(modules.has("archon:component/product-card")).toBe(true);
  });

  it("transforms named imports", () => {
    const source = `import { useState, useEffect } from "archon:react";
export default function({ tool }) {
  const [x, setX] = useState(0);
  return null;
}`;
    const { code, modules } = transformImports(source);
    expect(code).toContain(
      'const { useState, useEffect } = __deps__["archon:react"];'
    );
    expect(modules.has("archon:react")).toBe(true);
  });

  it("transforms mixed default and named imports", () => {
    const source = `import React, { useState } from "archon:react";
export default function() { return null; }`;
    const { code } = transformImports(source);
    expect(code).toContain(
      'const React = __deps__["archon:react"].default;'
    );
    expect(code).toContain(
      'const { useState } = __deps__["archon:react"];'
    );
  });

  it("transforms renamed imports", () => {
    const source = `import { Badge as MyBadge } from "archon:ui";
export default function() { return null; }`;
    const { code } = transformImports(source);
    expect(code).toContain(
      'const { Badge: MyBadge } = __deps__["archon:ui"];'
    );
  });

  it("handles multiple import lines", () => {
    const source = `import { useState } from "archon:react";
import { Badge, Table } from "archon:ui";
import { ChevronRight } from "archon:icons";

export default function({ tool }) {
  return <Badge>{tool.output.status}</Badge>;
}`;
    const { code, modules } = transformImports(source);
    expect(modules.size).toBe(3);
    expect(code).toContain('__deps__["archon:react"]');
    expect(code).toContain('__deps__["archon:ui"]');
    expect(code).toContain('__deps__["archon:icons"]');
  });

  it("handles export default expression", () => {
    const source = `import { Badge } from "archon:ui";
export default ({ tool }) => <Badge>{tool.output.x}</Badge>;`;
    const { code } = transformImports(source);
    expect(code).toContain("var __default_export__ = ");
    expect(code).toContain("return __default_export__;");
  });

  it("preserves non-import/export lines", () => {
    const source = `import { useState } from "archon:react";

const COLORS = ["red", "blue"];

export default function() {
  const [idx, setIdx] = useState(0);
  return COLORS[idx];
}`;
    const { code } = transformImports(source);
    expect(code).toContain('const COLORS = ["red", "blue"];');
  });

  it("collects all referenced modules", () => {
    const source = `import { useState } from "archon:react";
import { Badge } from "archon:ui";
import { FileText } from "archon:icons";
import ProductCard from "archon:component/product-card";
export default function() { return null; }`;
    const { modules } = transformImports(source);
    expect(modules).toEqual(
      new Set([
        "archon:react",
        "archon:ui",
        "archon:icons",
        "archon:component/product-card",
      ])
    );
  });
});
