// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { PoolRefBadge } from "../pool-ref-badge";

describe("PoolRefBadge", () => {
  it("shows '系统内置' for builtin origin", () => {
    render(<PoolRefBadge origin="builtin" />);
    expect(screen.getByText("系统内置")).toBeInTheDocument();
  });

  it("shows '共享池' for user origin", () => {
    render(<PoolRefBadge origin="user" />);
    expect(screen.getByText("共享池")).toBeInTheDocument();
  });

  it("shows '共享池' for marketplace origin", () => {
    render(<PoolRefBadge origin="marketplace" />);
    expect(screen.getByText("共享池")).toBeInTheDocument();
  });
});
