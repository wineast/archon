import { describe, it, expect } from "vitest";
import { remapParameterRefs } from "../snapshot";
import type { ToolParameter } from "@/lib/tools/types";

describe("remapParameterRefs", () => {
  const schemaMap = new Map([
    ["uuid-schema-1", "key-schema-1"],
    ["uuid-schema-2", "key-schema-2"],
  ]);
  const datasetMap = new Map([
    ["uuid-ds-1", "key-ds-1"],
    ["uuid-ds-2", "key-ds-2"],
  ]);

  it("replaces schemaId UUID with mapped value", () => {
    const params: ToolParameter[] = [
      {
        id: "p1",
        name: "address",
        type: "json",
        description: "",
        required: true,
        schemaId: "uuid-schema-1",
      },
    ];
    const result = remapParameterRefs(params, schemaMap, datasetMap);
    expect(result[0].schemaId).toBe("key-schema-1");
  });

  it("replaces enumDatasetId UUID with mapped value", () => {
    const params: ToolParameter[] = [
      {
        id: "p1",
        name: "category",
        type: "enum",
        description: "",
        required: true,
        enumDatasetId: "uuid-ds-1",
      },
    ];
    const result = remapParameterRefs(params, schemaMap, datasetMap);
    expect(result[0].enumDatasetId).toBe("key-ds-1");
  });

  it("recursively replaces refs in nested properties", () => {
    const params: ToolParameter[] = [
      {
        id: "p1",
        name: "outer",
        type: "json",
        description: "",
        required: true,
        properties: [
          {
            id: "p2",
            name: "inner",
            type: "json",
            description: "",
            required: true,
            schemaId: "uuid-schema-2",
          },
          {
            id: "p3",
            name: "status",
            type: "enum",
            description: "",
            required: false,
            enumDatasetId: "uuid-ds-2",
          },
        ],
      },
    ];
    const result = remapParameterRefs(params, schemaMap, datasetMap);
    expect(result[0].properties![0].schemaId).toBe("key-schema-2");
    expect(result[0].properties![1].enumDatasetId).toBe("key-ds-2");
  });

  it("keeps unmatched references unchanged", () => {
    const params: ToolParameter[] = [
      {
        id: "p1",
        name: "field",
        type: "json",
        description: "",
        required: true,
        schemaId: "unknown-uuid",
      },
      {
        id: "p2",
        name: "field2",
        type: "enum",
        description: "",
        required: true,
        enumDatasetId: "unknown-ds-uuid",
      },
    ];
    const result = remapParameterRefs(params, schemaMap, datasetMap);
    expect(result[0].schemaId).toBe("unknown-uuid");
    expect(result[1].enumDatasetId).toBe("unknown-ds-uuid");
  });

  it("passes through empty array", () => {
    const result = remapParameterRefs([], schemaMap, datasetMap);
    expect(result).toEqual([]);
  });

  it("passes through parameters with no refs", () => {
    const params: ToolParameter[] = [
      {
        id: "p1",
        name: "query",
        type: "string",
        description: "search",
        required: true,
      },
      {
        id: "p2",
        name: "count",
        type: "number",
        description: "",
        required: false,
      },
    ];
    const result = remapParameterRefs(params, schemaMap, datasetMap);
    expect(result).toEqual(params);
  });

  it("does not mutate original parameters", () => {
    const params: ToolParameter[] = [
      {
        id: "p1",
        name: "field",
        type: "json",
        description: "",
        required: true,
        schemaId: "uuid-schema-1",
        properties: [
          {
            id: "p2",
            name: "nested",
            type: "enum",
            description: "",
            required: true,
            enumDatasetId: "uuid-ds-1",
          },
        ],
      },
    ];
    remapParameterRefs(params, schemaMap, datasetMap);
    expect(params[0].schemaId).toBe("uuid-schema-1");
    expect(params[0].properties![0].enumDatasetId).toBe("uuid-ds-1");
  });
});
