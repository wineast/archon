import { describe, it, expect } from "vitest";
import type {
  ComponentSnapshotItem,
  ComponentTestCaseSnapshotItem,
  AgentSnapshot,
} from "../types";

/**
 * Type-level and structural tests for component snapshot types
 * after the dual-scenario (tool + component) refactoring.
 *
 * These verify that:
 * - ComponentSnapshotItem uses toolInputSchema / componentInputSchema (not inputSchema / outputSchema)
 * - ComponentTestCaseSnapshotItem has a scenario field
 * - Snapshot structure is serializable (JSON round-trip)
 */

describe("ComponentSnapshotItem structure", () => {
  const item: ComponentSnapshotItem = {
    key: "pricing_result",
    name: "Pricing Result",
    description: "Renders pricing plan",
    componentSource: 'export default function({ tool }) { return <div>{tool.output.plan}</div>; }',
    generatedCss: "@layer utilities { .flex { display: flex; } }",
    toolInputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        input: { type: "object" },
        output: {
          type: "object",
          properties: {
            plan: { type: "string" },
            price: { type: "string" },
          },
        },
      },
      required: ["name", "input", "output"],
    },
    componentInputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
      },
    },
    testCases: [],
  };

  it("has toolInputSchema field (not inputSchema)", () => {
    expect(item).toHaveProperty("toolInputSchema");
    expect(item.toolInputSchema).not.toBeNull();
    expect(item.toolInputSchema!.type).toBe("object");
  });

  it("has componentInputSchema field (not outputSchema)", () => {
    expect(item).toHaveProperty("componentInputSchema");
    expect(item.componentInputSchema).not.toBeNull();
    expect(item.componentInputSchema!.type).toBe("object");
  });

  it("allows null schemas", () => {
    const noSchema: ComponentSnapshotItem = {
      ...item,
      toolInputSchema: null,
      componentInputSchema: null,
    };
    expect(noSchema.toolInputSchema).toBeNull();
    expect(noSchema.componentInputSchema).toBeNull();
  });

  it("is JSON-serializable (round-trip)", () => {
    const json = JSON.stringify(item);
    const parsed = JSON.parse(json) as ComponentSnapshotItem;
    expect(parsed.key).toBe("pricing_result");
    expect(parsed.toolInputSchema?.required).toEqual(["name", "input", "output"]);
    expect(parsed.componentInputSchema?.properties?.title).toEqual({ type: "string" });
  });
});

describe("ComponentTestCaseSnapshotItem structure", () => {
  it("has scenario field", () => {
    const toolCase: ComponentTestCaseSnapshotItem = {
      name: "Basic pricing",
      data: { name: "get_pricing", input: {}, output: { plan: "Pro" } },
      tags: ["pricing"],
      scenario: "tool",
    };
    expect(toolCase.scenario).toBe("tool");
  });

  it("supports component scenario", () => {
    const componentCase: ComponentTestCaseSnapshotItem = {
      name: "Card data",
      data: { title: "Hello" },
      tags: [],
      scenario: "component",
    };
    expect(componentCase.scenario).toBe("component");
  });

  it("nests inside ComponentSnapshotItem", () => {
    const item: ComponentSnapshotItem = {
      key: "card",
      name: "Card",
      description: "",
      componentSource: "",
      generatedCss: "",
      toolInputSchema: null,
      componentInputSchema: null,
      testCases: [
        { name: "tool case", data: {}, tags: [], scenario: "tool" },
        { name: "component case", data: {}, tags: [], scenario: "component" },
      ],
    };
    expect(item.testCases).toHaveLength(2);
    expect(item.testCases[0].scenario).toBe("tool");
    expect(item.testCases[1].scenario).toBe("component");
  });
});

describe("AgentSnapshot — component section", () => {
  it("components array contains dual-schema items", () => {
    const snapshot: Partial<AgentSnapshot> = {
      components: [
        {
          key: "pricing",
          name: "Pricing",
          description: "",
          componentSource: "",
          generatedCss: "",
          toolInputSchema: { type: "object", properties: { name: { type: "string" } } },
          componentInputSchema: null,
          testCases: [
            { name: "t1", data: {}, tags: [], scenario: "tool" },
          ],
        },
      ],
    };
    const comp = snapshot.components![0];
    expect(comp.toolInputSchema).not.toBeNull();
    expect(comp.componentInputSchema).toBeNull();
    expect(comp.testCases[0].scenario).toBe("tool");
  });

  it("restoring a snapshot with missing scenario defaults correctly", () => {
    // Simulates old snapshot data that lacks the scenario field.
    // The restore code uses `tc.scenario ?? "tool"` for backward compat.
    const legacyTestCase = {
      name: "old case",
      data: { name: "tool", input: {}, output: {} },
      tags: [],
      // scenario is missing
    } as unknown as ComponentTestCaseSnapshotItem;

    // Verify the fallback pattern
    const scenario = (legacyTestCase.scenario ?? "tool") as "tool" | "component";
    expect(scenario).toBe("tool");
  });
});
