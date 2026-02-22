import { describe, it, expect, vi } from "vitest";
import { executeToolInSandbox, SandboxError, SandboxTimeoutError } from "../sandbox";
import type { ToolContext } from "../tool-context";

function createMockContext(overrides?: Partial<ToolContext>): ToolContext {
  return {
    wiki: {
      get: vi.fn().mockResolvedValue({ meta: null, content: "Hello wiki" }),
      findByPrefix: vi.fn().mockResolvedValue([]),
      search: vi.fn().mockResolvedValue([]),
    },
    dataset: {
      get: vi.fn().mockResolvedValue({ key: "value" }),
    },
    fn: vi.fn().mockResolvedValue((x: number) => x * 2),
    ontology: {
      types: vi.fn().mockResolvedValue([]),
      type: vi.fn().mockResolvedValue(null),
      query: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "new-id", label: "New" }),
      update: vi.fn().mockResolvedValue({ id: "id", label: "Updated" }),
      delete: vi.fn().mockResolvedValue({ ok: true }),
      link: vi.fn().mockResolvedValue({ id: "link-id" }),
      unlink: vi.fn().mockResolvedValue({ ok: true }),
      graph: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
    },
    ...overrides,
  };
}

describe("executeToolInSandbox", () => {
  it("executes a pure sync handler", async () => {
    const ctx = createMockContext();
    const result = await executeToolInSandbox(
      `export default function(args) { return { result: args.x * 2 }; }`,
      { x: 21 },
      ctx
    );
    expect(result).toEqual({ result: 42 });
  });

  it("executes a handler returning a string", async () => {
    const ctx = createMockContext();
    const result = await executeToolInSandbox(
      "export default function(args) { return `Hello ${args.name}`; }",
      { name: "World" },
      ctx
    );
    expect(result).toBe("Hello World");
  });

  it("executes an async handler with await", async () => {
    const ctx = createMockContext();
    const result = await executeToolInSandbox(
      `export default async function(args) { const x = await Promise.resolve(args.x + 1); return { value: x }; }`,
      { x: 10 },
      ctx
    );
    expect(result).toEqual({ value: 11 });
  });

  it("calls wiki.get via import", async () => {
    const ctx = createMockContext();
    const result = await executeToolInSandbox(
      `import { wiki } from "archon:context";
export default async function(args) {
  const doc = await wiki.get(args.id);
  return doc;
}`,
      { id: "my-doc" },
      ctx
    );
    // QJS drops null-valued properties during marshal round-trip
    expect(result).toEqual({ content: "Hello wiki" });
    expect(ctx.wiki.get).toHaveBeenCalledWith("my-doc");
  });

  it("calls dataset.get via import", async () => {
    const ctx = createMockContext();
    const result = await executeToolInSandbox(
      `import { dataset } from "archon:context";
export default async function(args) {
  return await dataset.get(args.key);
}`,
      { key: "prices" },
      ctx
    );
    expect(result).toEqual({ key: "value" });
    expect(ctx.dataset.get).toHaveBeenCalledWith("prices");
  });

  it("calls ontology.create via import", async () => {
    const ctx = createMockContext();
    const result = await executeToolInSandbox(
      `import { ontology } from "archon:context";
export default async function(args) {
  return await ontology.create(args.type, args.data);
}`,
      { type: "customer", data: { name: "Alice" } },
      ctx
    );
    expect(result).toEqual({ id: "new-id", label: "New" });
    expect(ctx.ontology.create).toHaveBeenCalledWith("customer", {
      name: "Alice",
    });
  });

  it("times out on infinite loop", async () => {
    const ctx = createMockContext();
    await expect(
      executeToolInSandbox(
        `export default function() { while(true){} }`,
        {},
        ctx,
        { timeoutMs: 200 }
      )
    ).rejects.toThrow(SandboxTimeoutError);
  });

  it("cannot access process global", async () => {
    const ctx = createMockContext();
    const result = await executeToolInSandbox(
      `export default function() { return { hasProcess: typeof process !== 'undefined' }; }`,
      {},
      ctx
    );
    expect(result).toEqual({ hasProcess: false });
  });

  it("cannot access fetch global", async () => {
    const ctx = createMockContext();
    const result = await executeToolInSandbox(
      `export default function() { return { hasFetch: typeof fetch !== 'undefined' }; }`,
      {},
      ctx
    );
    expect(result).toEqual({ hasFetch: false });
  });

  it("cannot access require", async () => {
    const ctx = createMockContext();
    const result = await executeToolInSandbox(
      `export default function() { return { hasRequire: typeof require !== 'undefined' }; }`,
      {},
      ctx
    );
    expect(result).toEqual({ hasRequire: false });
  });

  it("throws SandboxError on runtime error in handler", async () => {
    const ctx = createMockContext();
    await expect(
      executeToolInSandbox(
        `export default function() { throw new Error('boom'); }`,
        {},
        ctx
      )
    ).rejects.toThrow(SandboxError);
  });

  it("throws SandboxError on syntax error", async () => {
    const ctx = createMockContext();
    await expect(
      executeToolInSandbox(
        `export default function() { invalid syntax !!! }`,
        {},
        ctx
      )
    ).rejects.toThrow(SandboxError);
  });

  it("handles handler returning null", async () => {
    const ctx = createMockContext();
    const result = await executeToolInSandbox(
      `export default function() { return null; }`,
      {},
      ctx
    );
    expect(result).toBeNull();
  });

  it("handles handler returning undefined", async () => {
    const ctx = createMockContext();
    const result = await executeToolInSandbox(
      `export default function() {}`,
      {},
      ctx
    );
    expect(result).toBeUndefined();
  });

  it("handles handler returning array", async () => {
    const ctx = createMockContext();
    const result = await executeToolInSandbox(
      `export default function(args) { return [args.a, args.b, args.a + args.b]; }`,
      { a: 1, b: 2 },
      ctx
    );
    expect(result).toEqual([1, 2, 3]);
  });

  it("throws SandboxError on legacy arrow function format", async () => {
    const ctx = createMockContext();
    await expect(
      executeToolInSandbox(
        `(args) => ({ result: args.x * 2 })`,
        { x: 21 },
        ctx
      )
    ).rejects.toThrow(SandboxError);
    await expect(
      executeToolInSandbox(
        `(args) => ({ result: args.x * 2 })`,
        { x: 21 },
        ctx
      )
    ).rejects.toThrow(/Legacy handler format is no longer supported/);
  });

  // ── ES module format tests (with imports) ──

  it("executes a module-format sync handler", async () => {
    const ctx = createMockContext();
    const result = await executeToolInSandbox(
      `export default function(args) { return { result: args.x * 2 }; }`,
      { x: 21 },
      ctx
    );
    expect(result).toEqual({ result: 42 });
  });

  it("executes a module-format handler importing archon:context", async () => {
    const ctx = createMockContext();
    const result = await executeToolInSandbox(
      `import { wiki } from "archon:context";
export default async function(args) {
  const doc = await wiki.get(args.id);
  return doc;
}`,
      { id: "my-doc" },
      ctx
    );
    expect(result).toEqual({ content: "Hello wiki" });
    expect(ctx.wiki.get).toHaveBeenCalledWith("my-doc");
  });

  it("executes a module-format handler with dataset access", async () => {
    const ctx = createMockContext();
    const result = await executeToolInSandbox(
      `import { dataset } from "archon:context";
export default async function(args) {
  return await dataset.get(args.key);
}`,
      { key: "prices" },
      ctx
    );
    expect(result).toEqual({ key: "value" });
    expect(ctx.dataset.get).toHaveBeenCalledWith("prices");
  });

  it("throws on module-format handler with non-function default export", async () => {
    const ctx = createMockContext();
    await expect(
      executeToolInSandbox(
        `export default 42;`,
        {},
        ctx
      )
    ).rejects.toThrow(SandboxError);
  });
});
