import { describe, it, expect, vi, beforeEach } from "vitest";
import { sessionsKey, deleteSession } from "../hooks";

// Mock sonner
vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

describe("sessionsKey", () => {
  it("returns base key when no agentId", () => {
    expect(sessionsKey()).toBe("/api/sessions");
  });

  it("returns key with agentId query param", () => {
    expect(sessionsKey("abc-123")).toBe("/api/sessions?agentId=abc-123");
  });
});

describe("deleteSession", () => {
  let mutate: () => void;

  beforeEach(() => {
    mutate = vi.fn() as unknown as () => void;
    vi.restoreAllMocks();
  });

  it("calls DELETE API and mutate on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });

    const result = await deleteSession("session-1", mutate);

    expect(fetch).toHaveBeenCalledWith("/api/sessions/session-1", {
      method: "DELETE",
    });
    expect(mutate).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("shows toast and returns false on API error", async () => {
    const { toast } = await import("sonner");

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve("Not found"),
    });

    const result = await deleteSession("bad-id", mutate);

    expect(mutate).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Failed to delete conversation");
    expect(result).toBe(false);
  });

  it("shows toast and returns false on network error", async () => {
    const { toast } = await import("sonner");

    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await deleteSession("session-1", mutate);

    expect(mutate).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Failed to delete conversation");
    expect(result).toBe(false);
  });
});
