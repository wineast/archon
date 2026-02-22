import { describe, it, expect } from "vitest";
import {
  isModuleFormat,
  inferDepsFromImports,
  inferComponentDepsFromImports,
} from "../detect";

describe("isModuleFormat", () => {
  it("detects import statements", () => {
    expect(isModuleFormat('import { foo } from "archon:fn/bar";')).toBe(true);
  });

  it("detects default import", () => {
    expect(isModuleFormat('import bar from "archon:fn/bar";')).toBe(true);
  });

  it("detects export default", () => {
    expect(isModuleFormat("export default function(input) {}")).toBe(true);
  });

  it("detects export with leading whitespace", () => {
    expect(isModuleFormat("  export default function(x) {}")).toBe(true);
  });

  it("returns false for legacy closure format", () => {
    expect(
      isModuleFormat(
        "function fn({ compileExpression }) { return function(input) { return 1; } }"
      )
    ).toBe(false);
  });

  it("returns false for arrow function handler", () => {
    expect(isModuleFormat("(args, context) => args.x * 2")).toBe(false);
  });

  it("ignores commented-out imports", () => {
    expect(
      isModuleFormat('// import { foo } from "bar";\nconst x = 1;')
    ).toBe(false);
  });

  it("detects multi-line module code", () => {
    const code = `
import other from "archon:fn/other";

export default function(input) {
  return other(input);
}`;
    expect(isModuleFormat(code)).toBe(true);
  });
});

describe("inferDepsFromImports", () => {
  const knownKeys = new Set(["calc", "format", "validate"]);

  it("extracts default import keys", () => {
    const code = `import calc from "archon:fn/calc";`;
    expect(inferDepsFromImports(code, knownKeys)).toEqual(["calc"]);
  });

  it("extracts named import keys", () => {
    const code = `import { default as myCalc } from "archon:fn/calc";`;
    expect(inferDepsFromImports(code, knownKeys)).toEqual(["calc"]);
  });

  it("extracts multiple imports", () => {
    const code = `
import calc from "archon:fn/calc";
import format from "archon:fn/format";
`;
    expect(inferDepsFromImports(code, knownKeys)).toEqual(["calc", "format"]);
  });

  it("ignores unknown keys", () => {
    const code = `import unknown from "archon:fn/unknown";`;
    expect(inferDepsFromImports(code, knownKeys)).toEqual([]);
  });

  it("ignores non-archon:fn imports", () => {
    const code = `
import { wiki } from "archon:context";
import calc from "archon:fn/calc";
`;
    expect(inferDepsFromImports(code, knownKeys)).toEqual(["calc"]);
  });
});

describe("inferComponentDepsFromImports", () => {
  const knownKeys = new Set(["product-card", "price-badge", "header"]);

  it("extracts component import keys", () => {
    const code = `import ProductCard from "archon:component/product-card";`;
    expect(inferComponentDepsFromImports(code, knownKeys)).toEqual([
      "product-card",
    ]);
  });

  it("extracts multiple component imports", () => {
    const code = `
import ProductCard from "archon:component/product-card";
import PriceBadge from "archon:component/price-badge";
`;
    expect(inferComponentDepsFromImports(code, knownKeys)).toEqual([
      "product-card",
      "price-badge",
    ]);
  });

  it("ignores unknown component keys", () => {
    const code = `import Unknown from "archon:component/unknown";`;
    expect(inferComponentDepsFromImports(code, knownKeys)).toEqual([]);
  });
});
