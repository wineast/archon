// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { AnnotationBadges } from "../mcp-tool-playground";

describe("AnnotationBadges", () => {
  it("renders nothing when annotations is undefined", () => {
    const { container } = render(<AnnotationBadges />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when all hints are false", () => {
    const { container } = render(
      <AnnotationBadges annotations={{ readOnlyHint: false, destructiveHint: false }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders readOnlyHint badge", () => {
    render(<AnnotationBadges annotations={{ readOnlyHint: true }} />);
    expect(screen.getByText("只读")).toBeInTheDocument();
  });

  it("renders destructiveHint badge with destructive variant", () => {
    render(<AnnotationBadges annotations={{ destructiveHint: true }} />);
    const badge = screen.getByText("破坏性");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-variant", "destructive");
  });

  it("renders idempotentHint badge", () => {
    render(<AnnotationBadges annotations={{ idempotentHint: true }} />);
    expect(screen.getByText("幂等")).toBeInTheDocument();
  });

  it("renders openWorldHint badge", () => {
    render(<AnnotationBadges annotations={{ openWorldHint: true }} />);
    expect(screen.getByText("开放世界")).toBeInTheDocument();
  });

  it("renders multiple badges when several hints are true", () => {
    render(
      <AnnotationBadges
        annotations={{ readOnlyHint: true, idempotentHint: true, openWorldHint: true }}
      />
    );
    expect(screen.getByText("只读")).toBeInTheDocument();
    expect(screen.getByText("幂等")).toBeInTheDocument();
    expect(screen.getByText("开放世界")).toBeInTheDocument();
    expect(screen.queryByText("破坏性")).not.toBeInTheDocument();
  });
});
