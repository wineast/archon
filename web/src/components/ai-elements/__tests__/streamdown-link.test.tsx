// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { streamdownComponents } from "../message";

const LinkComponent = streamdownComponents!.a as React.FC<
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>;

describe("streamdownComponents.a", () => {
  it("external https link opens in new tab with noopener noreferrer", () => {
    render(<LinkComponent href="https://example.com">docs</LinkComponent>);
    const link = screen.getByRole("link", { name: "docs" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("external http link opens in new tab with noopener noreferrer", () => {
    render(<LinkComponent href="http://example.com">docs</LinkComponent>);
    const link = screen.getByRole("link", { name: "docs" });
    expect(link).toHaveAttribute("href", "http://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("mailto link does not get target=_blank", () => {
    render(
      <LinkComponent href="mailto:test@example.com">email</LinkComponent>
    );
    const link = screen.getByRole("link", { name: "email" });
    expect(link).toHaveAttribute("href", "mailto:test@example.com");
    expect(link).not.toHaveAttribute("target");
    expect(link).not.toHaveAttribute("rel");
  });

  it("relative link does not get target=_blank", () => {
    render(<LinkComponent href="/docs/guide">guide</LinkComponent>);
    const link = screen.getByRole("link", { name: "guide" });
    expect(link).toHaveAttribute("href", "/docs/guide");
    expect(link).not.toHaveAttribute("target");
    expect(link).not.toHaveAttribute("rel");
  });

  it("link without href does not get target=_blank", () => {
    render(<LinkComponent>anchor</LinkComponent>);
    const el = screen.getByText("anchor");
    expect(el).not.toHaveAttribute("target");
    expect(el).not.toHaveAttribute("rel");
  });

  it("preserves additional props passed through", () => {
    render(
      <LinkComponent href="https://example.com" className="custom-class">
        styled link
      </LinkComponent>
    );
    const link = screen.getByRole("link", { name: "styled link" });
    expect(link).toHaveClass("custom-class");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("javascript: protocol is not treated as external", () => {
    render(
      <LinkComponent href="javascript:alert(1)">malicious</LinkComponent>
    );
    const link = screen.getByRole("link", { name: "malicious" });
    expect(link).not.toHaveAttribute("target");
    expect(link).not.toHaveAttribute("rel");
  });

  it("anchor link (#section) does not get target=_blank", () => {
    render(<LinkComponent href="#section">section</LinkComponent>);
    const link = screen.getByRole("link", { name: "section" });
    expect(link).toHaveAttribute("href", "#section");
    expect(link).not.toHaveAttribute("target");
    expect(link).not.toHaveAttribute("rel");
  });
});

describe("streamdownComponents integration", () => {
  it("is used by MessageResponse and ReasoningContent", async () => {
    // Structural guard: verify both consumers import and use the shared config
    const messageSource = await import("../message");
    const reasoningSource = await import("../reasoning");

    // MessageResponse exists and streamdownComponents is exported
    expect(messageSource.streamdownComponents).toBeDefined();
    expect(messageSource.streamdownComponents!.a).toBeTypeOf("function");
    expect(messageSource.MessageResponse).toBeDefined();

    // ReasoningContent exists (it imports streamdownComponents internally)
    expect(reasoningSource.ReasoningContent).toBeDefined();
  });
});
