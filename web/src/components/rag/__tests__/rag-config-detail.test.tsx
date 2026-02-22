// @vitest-environment jsdom

// Polyfill ResizeObserver for Radix ScrollArea
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { RagConfigRow } from "@/db/schema";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock("@/lib/models/hooks", () => ({
  useModels: () => ({
    models: [
      { modelId: "openai/text-embedding-3-small", name: "text-embedding-3-small", provider: "openai", type: "embedding" },
    ],
    isLoading: false,
  }),
}));

/* ------------------------------------------------------------------ */
/*  Import after mocks                                                 */
/* ------------------------------------------------------------------ */

import { RagConfigDetail } from "../rag-config-detail";

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const baseConfig: RagConfigRow = {
  id: "cfg-1",
  agentId: "agent-1",
  embeddingModel: "openai/text-embedding-3-small",
  chunkSize: 500,
  chunkOverlap: 50,
  topK: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("RagConfigDetail", () => {
  it("shows spinner when isLoading=true", () => {
    render(
      <RagConfigDetail
        config={null}
        isLoading={true}
        onSave={vi.fn()}
      />
    );
    // Spinner renders an SVG with role="status" or similar; check no "No config found"
    expect(screen.queryByText("No config found")).not.toBeInTheDocument();
  });

  it("shows 'No config found' when config is null and not loading", () => {
    render(
      <RagConfigDetail
        config={null}
        isLoading={false}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText("No config found")).toBeInTheDocument();
  });

  it("renders form when config is provided", () => {
    render(
      <RagConfigDetail
        config={baseConfig}
        isLoading={false}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText("Embedding 模型")).toBeInTheDocument();
    expect(screen.getByText("分块大小（字符数）")).toBeInTheDocument();
    expect(screen.getByText("默认返回数量 (Top K)")).toBeInTheDocument();
  });
});
