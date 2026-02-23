import { describe, it, expect } from "vitest";
import { toolsApiKey } from "@/lib/tools/hooks";
import { componentsApiKey } from "@/lib/components/hooks";
import { chatConfigApiKey } from "@/lib/chat-config/hooks";
import { modelConfigsApiKey, activeModelConfigApiKey } from "@/lib/model-config/hooks";

describe("hooks apiKey functions with mode parameter", () => {
  describe("toolsApiKey", () => {
    it("returns null when agentId is undefined", () => {
      expect(toolsApiKey(undefined)).toBeNull();
      expect(toolsApiKey(undefined, "published")).toBeNull();
    });

    it("returns URL without mode by default", () => {
      expect(toolsApiKey("a1")).toBe("/api/tools?agentId=a1");
    });

    it('appends mode=published when specified', () => {
      expect(toolsApiKey("a1", "published")).toBe("/api/tools?agentId=a1&mode=published");
    });

    it('appends versionId when { versionId } specified', () => {
      expect(toolsApiKey("a1", { versionId: "v-123" })).toBe("/api/tools?agentId=a1&versionId=v-123");
    });
  });

  describe("componentsApiKey", () => {
    it("returns null when agentId is undefined", () => {
      expect(componentsApiKey(undefined)).toBeNull();
    });

    it("returns URL without mode by default", () => {
      expect(componentsApiKey("a1")).toBe("/api/components?agentId=a1");
    });

    it('appends mode=published when specified', () => {
      expect(componentsApiKey("a1", "published")).toBe("/api/components?agentId=a1&mode=published");
    });

    it('appends versionId when { versionId } specified', () => {
      expect(componentsApiKey("a1", { versionId: "v-123" })).toBe("/api/components?agentId=a1&versionId=v-123");
    });
  });

  describe("chatConfigApiKey", () => {
    it("returns null when agentId is undefined", () => {
      expect(chatConfigApiKey(undefined)).toBeNull();
    });

    it("returns URL without mode by default", () => {
      expect(chatConfigApiKey("a1")).toBe("/api/chat-configs?agentId=a1");
    });

    it('appends mode=published when specified', () => {
      expect(chatConfigApiKey("a1", "published")).toBe("/api/chat-configs?agentId=a1&mode=published");
    });

    it('appends versionId when { versionId } specified', () => {
      expect(chatConfigApiKey("a1", { versionId: "v-123" })).toBe("/api/chat-configs?agentId=a1&versionId=v-123");
    });
  });

  describe("modelConfigsApiKey", () => {
    it("returns null when agentId is undefined", () => {
      expect(modelConfigsApiKey(undefined)).toBeNull();
    });

    it("returns URL without mode by default", () => {
      expect(modelConfigsApiKey("a1")).toBe("/api/model-configs?agentId=a1");
    });

    it('appends mode=published when specified', () => {
      expect(modelConfigsApiKey("a1", "published")).toBe("/api/model-configs?agentId=a1&mode=published");
    });

    it('appends versionId when { versionId } specified', () => {
      expect(modelConfigsApiKey("a1", { versionId: "v-123" })).toBe("/api/model-configs?agentId=a1&versionId=v-123");
    });
  });

  describe("activeModelConfigApiKey", () => {
    it("returns null when agentId is undefined", () => {
      expect(activeModelConfigApiKey(undefined)).toBeNull();
    });

    it("returns URL without mode by default", () => {
      expect(activeModelConfigApiKey("a1")).toBe("/api/model-configs/active?agentId=a1");
    });

    it('appends mode=published when specified', () => {
      expect(activeModelConfigApiKey("a1", "published")).toBe(
        "/api/model-configs/active?agentId=a1&mode=published"
      );
    });

    it('appends versionId when { versionId } specified', () => {
      expect(activeModelConfigApiKey("a1", { versionId: "v-123" })).toBe(
        "/api/model-configs/active?agentId=a1&versionId=v-123"
      );
    });
  });
});
