import { describe, it, expect, vi, beforeEach } from "vitest";
import type { KeyedMutator } from "swr";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
}));

vi.mock("@/stores/org-store", () => ({
  useOrgStore: vi.fn(() => ({
    currentOrgId: null,
    setCurrentOrgId: vi.fn(),
  })),
}));

// Import after mocks
const { createOrg } = await import("../hooks");
type OrgWithRole = Awaited<ReturnType<typeof createOrg>> & {};

const MOCK_ORG = {
  id: "org-1",
  name: "Test Org",
  slug: "test-org",
  isPersonal: false,
  avatarUrl: null,
  creditBalanceUSD: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  myRole: "owner",
};

describe("createOrg", () => {
  let mutate: KeyedMutator<unknown[]>;

  beforeEach(() => {
    mutate = vi.fn() as unknown as KeyedMutator<unknown[]>;
    vi.restoreAllMocks();
  });

  it("returns OrgWithRole on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_ORG),
    });

    const result = await createOrg(
      { name: "Test Org", slug: "test-org" },
      mutate as never
    );

    expect(fetch).toHaveBeenCalledWith("/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Org", slug: "test-org" }),
    });
    expect(result).toEqual(MOCK_ORG);
    expect(mutate).toHaveBeenCalled();
  });

  it("returns null and shows toast on failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve("slug already exists"),
    });

    const result = await createOrg({ name: "Dup Org" }, mutate as never);

    expect(result).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("创建组织失败");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("returns null on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await createOrg({ name: "Offline Org" }, mutate as never);

    expect(result).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("创建组织失败");
  });
});
