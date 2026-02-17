import { describe, it, expect, beforeEach } from "vitest";
import { registerTool, getToolExecutor } from "../_registry";

describe("tool registry", () => {
  // Note: registry is module-level state shared across tests.
  // Use unique keys per test to avoid collisions.

  describe("registerTool", () => {
    it("registers an executor that can be retrieved", () => {
      const executor = async () => ({ ok: true });
      registerTool("test_register", executor);
      expect(getToolExecutor("test_register")).toBe(executor);
    });

    it("overwrites existing executor for the same key", () => {
      const first = async () => ({ v: 1 });
      const second = async () => ({ v: 2 });
      registerTool("test_overwrite", first);
      registerTool("test_overwrite", second);
      expect(getToolExecutor("test_overwrite")).toBe(second);
    });
  });

  describe("getToolExecutor", () => {
    it("returns undefined for unregistered key", () => {
      expect(getToolExecutor("nonexistent_key_abc123")).toBeUndefined();
    });

    it("executes the registered function correctly", async () => {
      registerTool("test_exec", async (args: { x: number }) => ({
        result: args.x * 2,
      }));
      const executor = getToolExecutor("test_exec")!;
      const result = await executor({ x: 5 });
      expect(result).toEqual({ result: 10 });
    });
  });
});
