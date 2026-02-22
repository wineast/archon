// @vitest-environment jsdom

// Polyfill ResizeObserver for Radix ScrollArea
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ToolRow } from "@/db/schema";
import type { PoolMeta } from "@/components/pool/types";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock("@/lib/pool/ref-hooks", () => ({
  removeAgentRef: vi.fn().mockResolvedValue(undefined),
  toggleAgentRef: vi.fn().mockResolvedValue(undefined),
  useAgentRefs: () => ({ refs: [], mutate: vi.fn() }),
}));

vi.mock("@/lib/components/hooks", () => ({
  useComponents: () => ({ components: [], error: undefined, isLoading: false, mutate: vi.fn() }),
}));

vi.mock("@/components/editors/js-editor", () => ({
  JsEditor: ({ value }: { value: string }) => (
    <div data-testid="js-editor">{value}</div>
  ),
}));

vi.mock("@/components/editors/json-editor", () => ({
  JsonEditor: ({ value }: { value: string }) => (
    <div data-testid="json-editor">{value}</div>
  ),
}));

vi.mock("swr", () => ({
  default: () => ({ data: [], error: undefined, isLoading: false }),
}));

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const baseTool: ToolRow = {
  id: "tool-1",
  agentId: "agent-1",
  versionId: "version-1",
  key: "test_tool",
  name: "Test Tool",
  description: "A test tool",
  parametersSchema: null,
  returnParametersSchema: null,
  handler: "return {};",
  url: null,
  componentId: null,
  enabled: true,
  executionTarget: "server",
  sandboxMode: "light",
  origin: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const poolMeta: PoolMeta = {
  source: "pool",
  refId: "ref-1",
  refEnabled: true,
  origin: "user",
};

const builtinPoolMeta: PoolMeta = {
  source: "pool",
  refId: "ref-2",
  refEnabled: true,
  origin: "builtin",
};

/* ------------------------------------------------------------------ */
/*  Import after mocks                                                 */
/* ------------------------------------------------------------------ */

import { ToolDetail } from "../tool-detail";

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("ToolDetail — pool ref mode", () => {
  it("shows PoolRefBadge when poolMeta is provided", () => {
    render(
      <ToolDetail
        tool={baseTool}
        agentId="agent-1"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        poolMeta={poolMeta}
      />
    );
    expect(screen.getByText("共享池")).toBeInTheDocument();
  });

  it("shows '系统内置' badge for builtin pool ref", () => {
    render(
      <ToolDetail
        tool={baseTool}
        agentId="agent-1"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        poolMeta={builtinPoolMeta}
      />
    );
    expect(screen.getByText("系统内置")).toBeInTheDocument();
  });

  it("hides Save/Delete buttons when poolMeta is provided", () => {
    render(
      <ToolDetail
        tool={baseTool}
        agentId="agent-1"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        poolMeta={poolMeta}
      />
    );
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("shows '移除引用' button when poolMeta is provided", () => {
    render(
      <ToolDetail
        tool={baseTool}
        agentId="agent-1"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        poolMeta={poolMeta}
      />
    );
    expect(screen.getByRole("button", { name: /移除引用/i })).toBeInTheDocument();
  });

  it("shows enabled switch in pool ref mode for tool type", () => {
    render(
      <ToolDetail
        tool={baseTool}
        agentId="agent-1"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        poolMeta={poolMeta}
      />
    );
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("does NOT show PoolRefBadge when poolMeta is undefined", () => {
    render(
      <ToolDetail
        tool={baseTool}
        agentId="agent-1"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    expect(screen.queryByText("共享池")).not.toBeInTheDocument();
    expect(screen.queryByText("系统内置")).not.toBeInTheDocument();
  });

  it("shows Save and Delete buttons in normal mode", () => {
    render(
      <ToolDetail
        tool={baseTool}
        agentId="agent-1"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });
});
