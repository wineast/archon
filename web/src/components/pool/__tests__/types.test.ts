import { describe, it, expect } from "vitest";
import { toPoolMeta } from "../types";

describe("toPoolMeta", () => {
  it("returns undefined for private resources", () => {
    const item = { id: "1", origin: "user" as const, _source: "private" as const };
    expect(toPoolMeta(item)).toBeUndefined();
  });

  it("returns PoolMeta for pool resources", () => {
    const item = {
      id: "1",
      origin: "builtin" as const,
      _source: "pool" as const,
      _refId: "ref-1",
      _refEnabled: true,
    };
    expect(toPoolMeta(item)).toEqual({
      source: "pool",
      refId: "ref-1",
      refEnabled: true,
      origin: "builtin",
    });
  });

  it("returns undefined when pool but refId missing", () => {
    const item = { id: "1", origin: "user" as const, _source: "pool" as const };
    expect(toPoolMeta(item)).toBeUndefined();
  });

  it("defaults origin to 'user' when not set", () => {
    const item = {
      id: "1",
      _source: "pool" as const,
      _refId: "ref-1",
      _refEnabled: false,
    };
    const result = toPoolMeta(item);
    expect(result?.origin).toBe("user");
    expect(result?.refEnabled).toBe(false);
  });

  it("defaults refEnabled to true when not set", () => {
    const item = {
      id: "1",
      origin: "user" as const,
      _source: "pool" as const,
      _refId: "ref-1",
    };
    expect(toPoolMeta(item)?.refEnabled).toBe(true);
  });
});
