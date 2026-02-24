import { describe, it, expect } from "vitest";
import {
  extractCandidates,
  extractUtilityCss,
  compileCssForComponent,
} from "../compile-css";

// ---------------------------------------------------------------------------
// extractCandidates
// ---------------------------------------------------------------------------
describe("extractCandidates", () => {
  it("extracts typical Tailwind class names from JSX", () => {
    const source = `<div className="flex items-center gap-2 p-4 text-sm">hello</div>`;
    const candidates = extractCandidates(source);
    expect(candidates).toContain("flex");
    expect(candidates).toContain("items-center");
    expect(candidates).toContain("gap-2");
    expect(candidates).toContain("p-4");
    expect(candidates).toContain("text-sm");
  });

  it("extracts variant prefixed classes like hover: and dark:", () => {
    const source = `<button className="hover:bg-accent dark:text-white">click</button>`;
    const candidates = extractCandidates(source);
    expect(candidates).toContain("hover:bg-accent");
    expect(candidates).toContain("dark:text-white");
  });

  it("extracts arbitrary value classes with brackets", () => {
    const source = `<div className="w-[200px] bg-[#ff0000]">box</div>`;
    const candidates = extractCandidates(source);
    expect(candidates).toContain("w-[200px]");
    expect(candidates).toContain("bg-[#ff0000]");
  });

  it("skips JS keywords", () => {
    const source = `
      const x = true;
      if (false) { return null; }
      function render() { return <div className="flex">ok</div>; }
    `;
    const candidates = extractCandidates(source);
    expect(candidates).not.toContain("const");
    expect(candidates).not.toContain("true");
    expect(candidates).not.toContain("false");
    expect(candidates).not.toContain("return");
    expect(candidates).not.toContain("null");
    expect(candidates).not.toContain("function");
    expect(candidates).not.toContain("if");
  });

  it("skips tokens starting with a digit", () => {
    const source = `<div className="123abc 4px">x</div>`;
    const candidates = extractCandidates(source);
    expect(candidates).not.toContain("123abc");
    expect(candidates).not.toContain("4px");
  });

  it("skips single-character tokens", () => {
    const source = `<p className="a b c flex">x</p>`;
    const candidates = extractCandidates(source);
    expect(candidates).not.toContain("a");
    expect(candidates).not.toContain("b");
    expect(candidates).not.toContain("c");
    expect(candidates).toContain("flex");
  });

  it("deduplicates repeated class names", () => {
    const source = `<div className="flex flex flex p-4 p-4">x</div>`;
    const candidates = extractCandidates(source);
    const flexCount = candidates.filter((c) => c === "flex").length;
    expect(flexCount).toBe(1);
  });

  it("returns empty array for empty source", () => {
    expect(extractCandidates("")).toEqual([]);
  });

  it("returns empty array for source with only keywords and single chars", () => {
    const source = `const x = new Set(); if (true) return false;`;
    const candidates = extractCandidates(source);
    // Only "Set" should remain (not a keyword, length > 1)
    expect(candidates).toContain("Set");
    expect(candidates).not.toContain("const");
    expect(candidates).not.toContain("new");
  });
});

// ---------------------------------------------------------------------------
// extractUtilityCss
// ---------------------------------------------------------------------------
describe("extractUtilityCss", () => {
  it("extracts inner rules from @layer utilities (without the wrapper)", () => {
    const fullCss = `
:root { --color-primary: #000; }
@layer base { body { margin: 0; } }
@layer utilities {
  .flex { display: flex; }
  .p-4 { padding: 1rem; }
}
`;
    const result = extractUtilityCss(fullCss);
    expect(result).not.toContain("@layer utilities");
    expect(result).toContain(".flex");
    expect(result).toContain(".p-4");
    expect(result).not.toContain(":root");
    expect(result).not.toContain("@layer base");
  });

  it("handles nested braces within @layer utilities", () => {
    const fullCss = `
@layer utilities {
  .hover\\:bg-accent:hover { background-color: var(--accent); }
  @media (min-width: 768px) {
    .md\\:flex { display: flex; }
  }
}
`;
    const result = extractUtilityCss(fullCss);
    expect(result).not.toContain("@layer utilities");
    expect(result).toContain("hover");
    expect(result).toContain("@media");
    expect(result).toContain("md");
    // Should end properly — not truncated
    expect(result.trim().endsWith("}")).toBe(true);
  });

  it("extracts @property --tw-* declarations", () => {
    const fullCss = `
:root { --tw-shadow: none; }
@layer utilities { .shadow { box-shadow: var(--tw-shadow); } }
@property --tw-shadow { syntax: "*"; inherits: false; initial-value: none; }
@property --tw-ring-color { syntax: "*"; inherits: false; initial-value: transparent; }
`;
    const result = extractUtilityCss(fullCss);
    expect(result).toContain("@property --tw-shadow");
    expect(result).toContain("@property --tw-ring-color");
  });

  it("ignores non-tw @property declarations", () => {
    const fullCss = `
@layer utilities { .flex { display: flex; } }
@property --custom-color { syntax: "*"; inherits: false; }
@property --tw-shadow { syntax: "*"; inherits: false; initial-value: none; }
`;
    const result = extractUtilityCss(fullCss);
    expect(result).toContain("@property --tw-shadow");
    expect(result).not.toContain("--custom-color");
  });

  it("returns empty string when no utilities or @property found", () => {
    const fullCss = `:root { --color: red; } body { margin: 0; }`;
    const result = extractUtilityCss(fullCss);
    expect(result).toBe("");
  });

  it("handles @property only (no @layer utilities)", () => {
    const fullCss = `
:root { --tw-shadow: none; }
@property --tw-shadow { syntax: "*"; inherits: false; initial-value: none; }
`;
    const result = extractUtilityCss(fullCss);
    expect(result).toContain("@property --tw-shadow");
    expect(result).not.toContain(":root");
  });
});

// ---------------------------------------------------------------------------
// compileCssForComponent (integration)
// ---------------------------------------------------------------------------
describe("compileCssForComponent", () => {
  it("returns empty string for empty source", async () => {
    expect(await compileCssForComponent("")).toBe("");
    expect(await compileCssForComponent("   ")).toBe("");
    expect(await compileCssForComponent("\n\t")).toBe("");
  });

  it("generates CSS for basic Tailwind classes", async () => {
    const source = `<div className="flex items-center gap-2 p-4">hello</div>`;
    const css = await compileCssForComponent(source);
    expect(css).not.toContain("@layer utilities");
    expect(css).toContain("flex");
    expect(css).toContain("padding");
  });

  it("does not include :root or @layer base in output", async () => {
    const source = `<div className="flex p-4 text-sm bg-white">hello</div>`;
    const css = await compileCssForComponent(source);
    expect(css).not.toContain(":root");
    expect(css).not.toMatch(/@layer base\b/);
  });

  it("generates CSS for variant classes", async () => {
    const source = `<button className="hover:bg-blue-500 focus:ring-2">click</button>`;
    const css = await compileCssForComponent(source);
    expect(css).toContain("hover");
  });

  it("generates CSS for responsive modifiers", async () => {
    const source = `<div className="md:flex lg:grid">layout</div>`;
    const css = await compileCssForComponent(source);
    expect(css).toContain("@media");
  });

  it("handles a realistic pricing-result-like component", async () => {
    const source = `
      function PricingResult({ output }) {
        return (
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{output.plan}</h3>
              <span className="text-2xl font-bold text-primary">{output.price}</span>
            </div>
            <ul className="mt-4 space-y-2">
              {output.features?.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        );
      }
    `;
    const css = await compileCssForComponent(source);
    expect(css.length).toBeGreaterThan(0);
    expect(css).not.toContain("@layer utilities");
    // Should contain common utilities used above
    expect(css).toContain("rounded");
    expect(css).toContain("padding");
    expect(css).toContain("flex");
  });

  it("source with only JS keywords yields empty CSS", async () => {
    // Only keywords and single chars — no Tailwind candidates
    const source = `const x = true; if (false) return null;`;
    // "Set" or similar non-keyword tokens may produce output,
    // but pure keywords should not generate any utilities
    const css = await compileCssForComponent(source);
    // The remaining tokens (like "x") are single-char and skipped.
    // This should produce empty or minimal output
    expect(css).toBe("");
  });
});
