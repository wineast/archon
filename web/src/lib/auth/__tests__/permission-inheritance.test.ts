import { describe, it, expect } from "vitest";
import { computeEffectiveRole } from "../require-agent-role";

describe("computeEffectiveRole", () => {
  // ── Org role mapping ──

  it("org owner → agent owner", () => {
    expect(computeEffectiveRole(null, "owner", false)).toBe("owner");
  });

  it("org admin → agent admin", () => {
    expect(computeEffectiveRole(null, "admin", false)).toBe("admin");
  });

  it("org member → agent viewer", () => {
    expect(computeEffectiveRole(null, "member", false)).toBe("viewer");
  });

  // ── Direct role takes precedence when higher ──

  it("direct admin > org member → admin", () => {
    expect(computeEffectiveRole("admin", "member", false)).toBe("admin");
  });

  it("direct owner > org admin → owner", () => {
    expect(computeEffectiveRole("owner", "admin", false)).toBe("owner");
  });

  it("direct editor > org member → editor", () => {
    expect(computeEffectiveRole("editor", "member", false)).toBe("editor");
  });

  // ── Org role takes precedence when higher ──

  it("org owner > direct viewer → owner", () => {
    expect(computeEffectiveRole("viewer", "owner", false)).toBe("owner");
  });

  it("org admin > direct viewer → admin", () => {
    expect(computeEffectiveRole("viewer", "admin", false)).toBe("admin");
  });

  it("org admin > direct editor → admin", () => {
    expect(computeEffectiveRole("editor", "admin", false)).toBe("admin");
  });

  // ── Equal levels ──

  it("direct viewer + org member → viewer (both map to viewer level)", () => {
    // org member → viewer, direct viewer → viewer; direct wins (directLevel >= inheritedLevel)
    expect(computeEffectiveRole("viewer", "member", false)).toBe("viewer");
  });

  it("direct admin + org admin → admin", () => {
    expect(computeEffectiveRole("admin", "admin", false)).toBe("admin");
  });

  // ── Public access fallback ──

  it("no role + public → viewer", () => {
    expect(computeEffectiveRole(null, null, true)).toBe("viewer");
  });

  it("no role + private → null", () => {
    expect(computeEffectiveRole(null, null, false)).toBeNull();
  });

  // ── Public doesn't override membership ──

  it("org admin + public → admin (membership outranks public)", () => {
    expect(computeEffectiveRole(null, "admin", true)).toBe("admin");
  });

  it("direct editor + public → editor (membership outranks public)", () => {
    expect(computeEffectiveRole("editor", null, true)).toBe("editor");
  });

  // ── Only direct role ──

  it("direct viewer only → viewer", () => {
    expect(computeEffectiveRole("viewer", null, false)).toBe("viewer");
  });

  it("direct owner only → owner", () => {
    expect(computeEffectiveRole("owner", null, false)).toBe("owner");
  });
});
