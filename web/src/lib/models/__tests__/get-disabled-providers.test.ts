import { describe, it, expect } from "vitest";
import { getDisabledProviders } from "../get-disabled-providers";

describe("getDisabledProviders", () => {
  it("已配置的 BYOK provider 不禁用", () => {
    const result = getDisabledProviders(
      ["anthropic", "openai"],
      ["anthropic", "openai"]
    );
    expect(result).toEqual([]);
  });

  it("未配置的 BYOK provider 禁用", () => {
    const result = getDisabledProviders(
      ["anthropic", "openai", "google"],
      ["anthropic"]
    );
    expect(result).toEqual(["openai", "google"]);
  });

  it("meta/amazon 始终禁用", () => {
    const result = getDisabledProviders(
      ["meta", "amazon", "anthropic"],
      ["meta", "amazon", "anthropic"]
    );
    expect(result).toEqual(["meta", "amazon"]);
  });

  it("空配置 → 所有 BYOK provider 都禁用", () => {
    const result = getDisabledProviders(
      ["anthropic", "openai", "google"],
      []
    );
    expect(result).toEqual(["anthropic", "openai", "google"]);
  });

  it("去重 provider 列表", () => {
    const result = getDisabledProviders(
      ["anthropic", "anthropic", "openai"],
      ["anthropic"]
    );
    expect(result).toEqual(["openai"]);
  });

  it("空 allProviders 返回空数组", () => {
    const result = getDisabledProviders([], ["anthropic"]);
    expect(result).toEqual([]);
  });
});
