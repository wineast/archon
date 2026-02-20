import { describe, it, expect } from "vitest";
import { buildJsonSchema } from "../schema-builder";
import type { SchemaProperty } from "../types";

function makeParam(overrides: Partial<SchemaProperty> = {}): SchemaProperty {
  return {
    id: "p-1",
    name: "field",
    type: "string",
    description: "",
    required: true,
    ...overrides,
  };
}

describe("buildJsonSchema", () => {
  describe("basic structure", () => {
    it("returns a valid JSON Schema object with type 'object'", () => {
      const result = buildJsonSchema([]);
      expect(result).toEqual({ type: "object", properties: {} });
    });

    it("sets required array for required params", () => {
      const result = buildJsonSchema([
        makeParam({ name: "a", required: true }),
        makeParam({ name: "b", required: false }),
      ]);
      expect(result.required).toEqual(["a"]);
    });

    it("omits required array when no params are required", () => {
      const result = buildJsonSchema([
        makeParam({ name: "a", required: false }),
      ]);
      expect(result.required).toBeUndefined();
    });

    it("includes description on properties", () => {
      const result = buildJsonSchema([
        makeParam({ description: "A search query" }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.description).toBe("A search query");
    });

    it("omits description when empty", () => {
      const result = buildJsonSchema([makeParam({ description: "" })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.description).toBeUndefined();
    });
  });

  describe("string type", () => {
    it("maps to {type: 'string'}", () => {
      const result = buildJsonSchema([makeParam({ type: "string" })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.type).toBe("string");
    });

    it("includes minLength constraint", () => {
      const result = buildJsonSchema([makeParam({ type: "string", minLength: 3 })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.minLength).toBe(3);
    });

    it("includes maxLength constraint", () => {
      const result = buildJsonSchema([makeParam({ type: "string", maxLength: 100 })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.maxLength).toBe(100);
    });

    it("includes pattern constraint", () => {
      const result = buildJsonSchema([makeParam({ type: "string", pattern: "^[A-Z]+$" })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.pattern).toBe("^[A-Z]+$");
    });

    it("includes format constraint", () => {
      const result = buildJsonSchema([makeParam({ type: "string", format: "email" })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.format).toBe("email");
    });

    it("includes all string formats", () => {
      const formats = ["email", "url", "date", "date-time", "uuid"] as const;
      for (const fmt of formats) {
        const result = buildJsonSchema([makeParam({ type: "string", format: fmt })]);
        const props = result.properties as Record<string, Record<string, unknown>>;
        expect(props.field.format).toBe(fmt);
      }
    });

    it("includes defaultValue", () => {
      const result = buildJsonSchema([makeParam({ type: "string", defaultValue: "hello" })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.default).toBe("hello");
    });
  });

  describe("number type", () => {
    it("maps to {type: 'number'}", () => {
      const result = buildJsonSchema([makeParam({ type: "number" })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.type).toBe("number");
    });

    it("maps integer to {type: 'integer'}", () => {
      const result = buildJsonSchema([makeParam({ type: "number", integer: true })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.type).toBe("integer");
    });

    it("includes minimum constraint", () => {
      const result = buildJsonSchema([makeParam({ type: "number", minimum: 0 })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.minimum).toBe(0);
    });

    it("includes maximum constraint", () => {
      const result = buildJsonSchema([makeParam({ type: "number", maximum: 100 })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.maximum).toBe(100);
    });

    it("includes exclusiveMinimum constraint", () => {
      const result = buildJsonSchema([makeParam({ type: "number", exclusiveMinimum: 0 })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.exclusiveMinimum).toBe(0);
    });

    it("includes exclusiveMaximum constraint", () => {
      const result = buildJsonSchema([makeParam({ type: "number", exclusiveMaximum: 100 })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.exclusiveMaximum).toBe(100);
    });

    it("includes multipleOf constraint", () => {
      const result = buildJsonSchema([makeParam({ type: "number", multipleOf: 5 })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.multipleOf).toBe(5);
    });

    it("includes defaultValue", () => {
      const result = buildJsonSchema([makeParam({ type: "number", defaultValue: 42 })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.default).toBe(42);
    });
  });

  describe("boolean type", () => {
    it("maps to {type: 'boolean'}", () => {
      const result = buildJsonSchema([makeParam({ type: "boolean" })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.type).toBe("boolean");
    });

    it("includes defaultValue", () => {
      const result = buildJsonSchema([makeParam({ type: "boolean", defaultValue: false })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.default).toBe(false);
    });
  });

  describe("enum type → JSON Schema semantic mapping", () => {
    it("maps enum to {type: 'string', enum: [...]}", () => {
      const result = buildJsonSchema([
        makeParam({ type: "enum", enum: ["CA", "NY", "TX"] }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.type).toBe("string");
      expect(props.field.enum).toEqual(["CA", "NY", "TX"]);
    });

    it("omits enum array when empty", () => {
      const result = buildJsonSchema([makeParam({ type: "enum", enum: [] })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.type).toBe("string");
      expect(props.field.enum).toBeUndefined();
    });

    it("omits enum array when undefined", () => {
      const result = buildJsonSchema([makeParam({ type: "enum" })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.type).toBe("string");
      expect(props.field.enum).toBeUndefined();
    });

    it("includes defaultValue for enum", () => {
      const result = buildJsonSchema([
        makeParam({ type: "enum", enum: ["a", "b"], defaultValue: "a" }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.default).toBe("a");
    });
  });

  describe("object type", () => {
    it("maps to {type: 'object'} with no properties", () => {
      const result = buildJsonSchema([makeParam({ type: "object" })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.type).toBe("object");
    });

    it("maps nested properties correctly", () => {
      const result = buildJsonSchema([
        makeParam({
          type: "object",
          properties: [
            makeParam({ id: "c1", name: "name", type: "string", required: true, description: "User name" }),
            makeParam({ id: "c2", name: "age", type: "number", required: false }),
          ],
        }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      const objField = props.field;
      expect(objField.type).toBe("object");
      expect(objField.required).toEqual(["name"]);

      const nested = objField.properties as Record<string, Record<string, unknown>>;
      expect(nested.name.type).toBe("string");
      expect(nested.name.description).toBe("User name");
      expect(nested.age.type).toBe("number");
    });

    it("handles deeply nested objects", () => {
      const result = buildJsonSchema([
        makeParam({
          type: "object",
          properties: [
            makeParam({
              id: "c1",
              name: "address",
              type: "object",
              required: true,
              properties: [
                makeParam({ id: "c1a", name: "street", type: "string", required: true }),
                makeParam({ id: "c1b", name: "zip", type: "string", required: true }),
              ],
            }),
          ],
        }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      const outer = props.field;
      const nested = outer.properties as Record<string, Record<string, unknown>>;
      const address = nested.address;
      expect(address.type).toBe("object");

      const innerProps = address.properties as Record<string, Record<string, unknown>>;
      expect(innerProps.street.type).toBe("string");
      expect(innerProps.zip.type).toBe("string");
    });
  });

  describe("array type", () => {
    it("maps to {type: 'array'} with no items", () => {
      const result = buildJsonSchema([makeParam({ type: "array" })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.type).toBe("array");
      expect(props.field.items).toBeUndefined();
    });

    it("includes items schema", () => {
      const result = buildJsonSchema([
        makeParam({
          type: "array",
          items: makeParam({ id: "item", name: "item", type: "string" }),
        }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.type).toBe("array");
      expect(props.field.items).toEqual({ type: "string" });
    });

    it("includes minItems constraint", () => {
      const result = buildJsonSchema([
        makeParam({ type: "array", minItems: 1 }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.minItems).toBe(1);
    });

    it("includes maxItems constraint", () => {
      const result = buildJsonSchema([
        makeParam({ type: "array", maxItems: 10 }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.maxItems).toBe(10);
    });

    it("includes uniqueItems constraint", () => {
      const result = buildJsonSchema([
        makeParam({ type: "array", uniqueItems: true }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.uniqueItems).toBe(true);
    });

    it("handles array of objects", () => {
      const result = buildJsonSchema([
        makeParam({
          type: "array",
          items: makeParam({
            id: "item",
            name: "item",
            type: "object",
            properties: [
              makeParam({ id: "c1", name: "name", type: "string", required: true }),
            ],
          }),
        }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      const items = props.field.items as Record<string, unknown>;
      expect(items.type).toBe("object");
      const itemProps = items.properties as Record<string, Record<string, unknown>>;
      expect(itemProps.name.type).toBe("string");
    });

    it("handles array of enums", () => {
      const result = buildJsonSchema([
        makeParam({
          type: "array",
          items: makeParam({
            id: "item",
            name: "item",
            type: "enum",
            enum: ["red", "green", "blue"],
          }),
        }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      const items = props.field.items as Record<string, unknown>;
      expect(items.type).toBe("string");
      expect(items.enum).toEqual(["red", "green", "blue"]);
    });
  });

  describe("multiple parameters", () => {
    it("handles mixed types", () => {
      const result = buildJsonSchema([
        makeParam({ id: "1", name: "query", type: "string", required: true, description: "Search query" }),
        makeParam({ id: "2", name: "limit", type: "number", required: false }),
        makeParam({ id: "3", name: "active", type: "boolean", required: true }),
        makeParam({ id: "4", name: "status", type: "enum", enum: ["open", "closed"], required: true }),
      ]);

      expect(result.type).toBe("object");
      expect(result.required).toEqual(["query", "active", "status"]);

      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.query.type).toBe("string");
      expect(props.query.description).toBe("Search query");
      expect(props.limit.type).toBe("number");
      expect(props.active.type).toBe("boolean");
      expect(props.status.type).toBe("string");
      expect(props.status.enum).toEqual(["open", "closed"]);
    });
  });

  describe("null type", () => {
    it("maps to {type: 'null'}", () => {
      const result = buildJsonSchema([makeParam({ type: "null" })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field).toEqual({ type: "null" });
    });
  });

  describe("const type", () => {
    it("maps to {const: value}", () => {
      const result = buildJsonSchema([
        makeParam({ type: "const", constValue: "1.0" }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field).toEqual({ const: "1.0" });
    });

    it("maps numeric const", () => {
      const result = buildJsonSchema([
        makeParam({ type: "const", constValue: 42 }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field).toEqual({ const: 42 });
    });

    it("outputs empty object when no constValue", () => {
      const result = buildJsonSchema([makeParam({ type: "const" })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field).toEqual({});
    });
  });

  describe("new string formats", () => {
    it("includes time format", () => {
      const result = buildJsonSchema([makeParam({ type: "string", format: "time" })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.format).toBe("time");
    });

    it("includes ipv4 format", () => {
      const result = buildJsonSchema([makeParam({ type: "string", format: "ipv4" })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.format).toBe("ipv4");
    });

    it("includes ipv6 format", () => {
      const result = buildJsonSchema([makeParam({ type: "string", format: "ipv6" })]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.format).toBe("ipv6");
    });
  });

  describe("union type (oneOf / anyOf)", () => {
    it("outputs oneOf by default", () => {
      const result = buildJsonSchema([
        makeParam({
          type: "union",
          variants: [
            makeParam({ id: "v1", name: "", type: "object", required: true, properties: [
              makeParam({ id: "v1a", name: "x", type: "string", required: true }),
            ] }),
            makeParam({ id: "v2", name: "", type: "object", required: true, properties: [
              makeParam({ id: "v2a", name: "y", type: "number", required: true }),
            ] }),
          ],
        }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.oneOf).toBeDefined();
      expect(props.field.anyOf).toBeUndefined();
    });

    it("outputs anyOf when unionMode is anyOf", () => {
      const result = buildJsonSchema([
        makeParam({
          type: "union",
          unionMode: "anyOf",
          variants: [
            makeParam({ id: "v1", name: "", type: "object", required: true, properties: [
              makeParam({ id: "v1a", name: "x", type: "string", required: true }),
            ] }),
            makeParam({ id: "v2", name: "", type: "object", required: true, properties: [
              makeParam({ id: "v2a", name: "y", type: "number", required: true }),
            ] }),
          ],
        }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.anyOf).toBeDefined();
      expect(props.field.oneOf).toBeUndefined();
    });
  });

  describe("tuple (prefixItems)", () => {
    it("outputs items as array for tuple mode", () => {
      const result = buildJsonSchema([
        makeParam({
          type: "array",
          tuple: true,
          prefixItems: [
            makeParam({ id: "t0", name: "item0", type: "string" }),
            makeParam({ id: "t1", name: "item1", type: "number" }),
          ],
        }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.type).toBe("array");
      expect(props.field.items).toEqual([
        { type: "string" },
        { type: "number" },
      ]);
      // No minItems/maxItems in tuple mode
      expect(props.field.minItems).toBeUndefined();
      expect(props.field.maxItems).toBeUndefined();
    });
  });

  describe("allOf (schemaIds merge)", () => {
    it("outputs merged properties from multiple schemas", () => {
      const result = buildJsonSchema(
        [
          makeParam({
            type: "object",
            schemaIds: ["sa", "sb"],
          }),
        ],
        {
          schemaMap: {
            sa: [
              makeParam({ id: "a1", name: "name", type: "string", required: true }),
            ],
            sb: [
              makeParam({ id: "b1", name: "age", type: "number", required: false }),
            ],
          },
        }
      );
      const props = result.properties as Record<string, Record<string, unknown>>;
      const obj = props.field;
      expect(obj.type).toBe("object");
      const nested = obj.properties as Record<string, Record<string, unknown>>;
      expect(nested.name.type).toBe("string");
      expect(nested.age.type).toBe("number");
      expect(obj.required).toEqual(["name"]);
    });
  });

  describe("full snapshot", () => {
    it("generates complete JSON Schema for a complex tool", () => {
      const result = buildJsonSchema([
        makeParam({
          id: "1",
          name: "income_type",
          type: "enum",
          enum: ["Salary", "Bonus", "Rental"],
          description: "Type of income",
          required: true,
        }),
        makeParam({
          id: "2",
          name: "property_state",
          type: "enum",
          enum: ["CA", "NY"],
          description: "State abbreviation",
          required: true,
        }),
        makeParam({
          id: "3",
          name: "details",
          type: "object",
          description: "Additional details",
          required: false,
          properties: [
            makeParam({ id: "3a", name: "notes", type: "string", required: false }),
            makeParam({ id: "3b", name: "tags", type: "array", required: false, items: makeParam({ id: "3bi", name: "tag", type: "string" }) }),
          ],
        }),
      ]);

      expect(result).toEqual({
        type: "object",
        properties: {
          income_type: {
            type: "string",
            enum: ["Salary", "Bonus", "Rental"],
            description: "Type of income",
          },
          property_state: {
            type: "string",
            enum: ["CA", "NY"],
            description: "State abbreviation",
          },
          details: {
            type: "object",
            description: "Additional details",
            properties: {
              notes: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
            },
          },
        },
        required: ["income_type", "property_state"],
      });
    });
  });

  describe("schemaId reference", () => {
    it("resolves schemaId via schemaMap and outputs $ref + $defs", () => {
      const addressSchemaId = "schema-address-uuid";
      const schemaMap: Record<string, SchemaProperty[]> = {
        [addressSchemaId]: [
          makeParam({ id: "a1", name: "street", type: "string", required: true }),
          makeParam({ id: "a2", name: "city", type: "string", required: true }),
        ],
      };

      const result = buildJsonSchema(
        [
          makeParam({
            name: "address",
            type: "object",
            schemaId: addressSchemaId,
          }),
        ],
        { schemaMap }
      );

      // Top-level property should be a $ref
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.address).toEqual({ $ref: `#/$defs/${addressSchemaId}` });

      // $defs should contain the resolved schema
      const defs = result.$defs as Record<string, Record<string, unknown>>;
      expect(defs[addressSchemaId]).toEqual({
        type: "object",
        properties: {
          street: { type: "string" },
          city: { type: "string" },
        },
        required: ["street", "city"],
      });
    });

    it("ignores schemaId when schemaMap is not provided", () => {
      const result = buildJsonSchema([
        makeParam({ name: "data", type: "object", schemaId: "missing-uuid" }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.data).toEqual({ type: "object" });
      expect(result.$defs).toBeUndefined();
    });
  });

  describe("recursive self-reference", () => {
    it("outputs $ref for recursive schemaId instead of infinite expansion", () => {
      const treeSchemaId = "schema-tree-uuid";
      const schemaMap: Record<string, SchemaProperty[]> = {
        [treeSchemaId]: [
          makeParam({ id: "t1", name: "value", type: "string", required: true }),
          makeParam({
            id: "t2",
            name: "children",
            type: "array",
            required: false,
            items: makeParam({
              id: "t3",
              name: "child",
              type: "object",
              schemaId: treeSchemaId, // recursive self-reference
            }),
          }),
        ],
      };

      const result = buildJsonSchema(
        [
          makeParam({
            name: "tree",
            type: "object",
            schemaId: treeSchemaId,
          }),
        ],
        { schemaMap }
      );

      // Top-level: $ref
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.tree).toEqual({ $ref: `#/$defs/${treeSchemaId}` });

      // $defs: the tree def should have children.items as $ref (recursive)
      const defs = result.$defs as Record<string, Record<string, unknown>>;
      const treeDef = defs[treeSchemaId];
      expect(treeDef.type).toBe("object");

      const treeProps = treeDef.properties as Record<string, Record<string, unknown>>;
      expect(treeProps.value).toEqual({ type: "string" });

      const childrenProp = treeProps.children;
      expect(childrenProp.type).toBe("array");
      expect(childrenProp.items).toEqual({ $ref: `#/$defs/${treeSchemaId}` });
    });
  });

  describe("additionalProperties", () => {
    it("outputs additionalProperties for pure Map/Record object", () => {
      const result = buildJsonSchema([
        makeParam({
          name: "metadata",
          type: "object",
          additionalProperties: makeParam({ id: "ap", name: "val", type: "string" }),
        }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.metadata).toEqual({
        type: "object",
        additionalProperties: { type: "string" },
      });
    });

    it("outputs additionalProperties combined with fixed properties", () => {
      const result = buildJsonSchema([
        makeParam({
          name: "config",
          type: "object",
          properties: [
            makeParam({ id: "c1", name: "name", type: "string", required: true }),
          ],
          additionalProperties: makeParam({ id: "ap", name: "extra", type: "number" }),
        }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.config).toEqual({
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
        additionalProperties: { type: "number" },
      });
    });

    it("outputs additionalProperties on schemaId reference", () => {
      const baseId = "schema-base-uuid";
      const schemaMap: Record<string, SchemaProperty[]> = {
        [baseId]: [
          makeParam({ id: "b1", name: "id", type: "string", required: true }),
        ],
      };

      const result = buildJsonSchema(
        [
          makeParam({
            name: "extended",
            type: "object",
            schemaId: baseId,
            additionalProperties: makeParam({ id: "ap", name: "val", type: "string" }),
          }),
        ],
        { schemaMap }
      );

      const defs = result.$defs as Record<string, Record<string, unknown>>;
      expect(defs[baseId]).toEqual({
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: { type: "string" },
      });
    });
  });

  describe("union type", () => {
    it("outputs oneOf for union with object variants", () => {
      const result = buildJsonSchema([
        makeParam({
          name: "payment",
          type: "union",
          variants: [
            makeParam({
              id: "v1", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v1a", name: "method", type: "string", required: true }),
                makeParam({ id: "v1b", name: "card_number", type: "string", required: true }),
              ],
            }),
            makeParam({
              id: "v2", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v2a", name: "method", type: "string", required: true }),
                makeParam({ id: "v2b", name: "account", type: "string", required: true }),
              ],
            }),
          ],
        }),
      ]);

      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.payment.oneOf).toEqual([
        {
          type: "object",
          properties: {
            method: { type: "string" },
            card_number: { type: "string" },
          },
          required: ["method", "card_number"],
        },
        {
          type: "object",
          properties: {
            method: { type: "string" },
            account: { type: "string" },
          },
          required: ["method", "account"],
        },
      ]);
    });

    it("includes discriminator when specified", () => {
      const result = buildJsonSchema([
        makeParam({
          name: "shape",
          type: "union",
          discriminator: "kind",
          discriminatorValues: ["circle", "square"],
          variants: [
            makeParam({
              id: "v1", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v1b", name: "radius", type: "number", required: true }),
              ],
            }),
            makeParam({
              id: "v2", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v2b", name: "side", type: "number", required: true }),
              ],
            }),
          ],
        }),
      ]);

      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.shape.discriminator).toEqual({ propertyName: "kind" });

      // Each variant should have the injected const discriminator field
      const variants = props.shape.oneOf as Record<string, unknown>[];
      const v0Props = (variants[0] as Record<string, unknown>).properties as Record<string, Record<string, unknown>>;
      expect(v0Props.kind).toEqual({ const: "circle" });
      expect((variants[0] as Record<string, unknown>).required).toContain("kind");

      const v1Props = (variants[1] as Record<string, unknown>).properties as Record<string, Record<string, unknown>>;
      expect(v1Props.kind).toEqual({ const: "square" });
      expect((variants[1] as Record<string, unknown>).required).toContain("kind");
    });

    it("discriminatorValues injects const and required into each variant", () => {
      const result = buildJsonSchema([
        makeParam({
          name: "animal",
          type: "union",
          discriminator: "type",
          discriminatorValues: ["cat", "dog"],
          variants: [
            makeParam({
              id: "v1", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v1a", name: "lives", type: "number", required: true }),
              ],
            }),
            makeParam({
              id: "v2", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v2a", name: "breed", type: "string", required: true }),
              ],
            }),
          ],
        }),
      ]);

      const props = result.properties as Record<string, Record<string, unknown>>;
      const variants = props.animal.oneOf as Record<string, unknown>[];

      // Variant 0: should have { type: { const: "cat" } } injected
      const v0 = variants[0] as Record<string, unknown>;
      const v0Props = v0.properties as Record<string, Record<string, unknown>>;
      expect(v0Props.type).toEqual({ const: "cat" });
      expect(v0Props.lives).toEqual({ type: "number" });
      expect(v0.required).toEqual(["lives", "type"]);

      // Variant 1: should have { type: { const: "dog" } } injected
      const v1 = variants[1] as Record<string, unknown>;
      const v1Props = v1.properties as Record<string, Record<string, unknown>>;
      expect(v1Props.type).toEqual({ const: "dog" });
      expect(v1Props.breed).toEqual({ type: "string" });
      expect(v1.required).toEqual(["breed", "type"]);
    });

    it("returns empty object for union with < 2 variants", () => {
      const result = buildJsonSchema([
        makeParam({
          name: "bad",
          type: "union",
          variants: [
            makeParam({ id: "v1", name: "", type: "object", required: true, properties: [
              makeParam({ id: "v1a", name: "a", type: "string", required: true }),
            ] }),
          ],
        }),
      ]);

      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.bad).toEqual({});
    });
  });

  // ───────── Nullable ─────────

  describe("nullable", () => {
    it("nullable string outputs anyOf with null", () => {
      const result = buildJsonSchema([
        makeParam({ type: "string", nullable: true }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field).toEqual({
        anyOf: [{ type: "string" }, { type: "null" }],
      });
    });

    it("nullable number outputs anyOf with null", () => {
      const result = buildJsonSchema([
        makeParam({ type: "number", nullable: true }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field).toEqual({
        anyOf: [{ type: "number" }, { type: "null" }],
      });
    });

    it("nullable boolean outputs anyOf with null", () => {
      const result = buildJsonSchema([
        makeParam({ type: "boolean", nullable: true }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field).toEqual({
        anyOf: [{ type: "boolean" }, { type: "null" }],
      });
    });

    it("nullable enum outputs anyOf with null", () => {
      const result = buildJsonSchema([
        makeParam({ type: "enum", enum: ["a", "b"], nullable: true }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field).toEqual({
        anyOf: [{ type: "string", enum: ["a", "b"] }, { type: "null" }],
      });
    });

    it("non-nullable does not add anyOf wrapper", () => {
      const result = buildJsonSchema([
        makeParam({ type: "string" }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field).toEqual({ type: "string" });
      expect(props.field.anyOf).toBeUndefined();
    });
  });

  // ───────── Primitive type unions ─────────

  describe("primitive type unions", () => {
    it("string | number outputs oneOf with primitive types", () => {
      const result = buildJsonSchema([
        makeParam({
          type: "union",
          variants: [
            makeParam({ id: "v1", name: "", type: "string", required: true }),
            makeParam({ id: "v2", name: "", type: "number", required: true }),
          ],
        }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.oneOf).toEqual([
        { type: "string" },
        { type: "number" },
      ]);
    });

    it("mixed string | object union", () => {
      const result = buildJsonSchema([
        makeParam({
          type: "union",
          variants: [
            makeParam({ id: "v1", name: "", type: "string", required: true }),
            makeParam({
              id: "v2", name: "", type: "object", required: true,
              properties: [
                makeParam({ id: "v2a", name: "name", type: "string", required: true }),
              ],
            }),
          ],
        }),
      ]);
      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.oneOf).toEqual([
        { type: "string" },
        { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      ]);
    });
  });

  describe("enumDatasetId resolution", () => {
    it("resolves enum values from datasetsById array", () => {
      const datasetId = "ds-states-uuid";
      const result = buildJsonSchema(
        [
          makeParam({
            type: "enum",
            enumDatasetId: datasetId,
          }),
        ],
        { datasetsById: { [datasetId]: ["CA", "NY", "TX"] } }
      );

      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.enum).toEqual(["CA", "NY", "TX"]);
    });

    it("resolves enum values from datasetsById object (string values → values)", () => {
      const datasetId = "ds-income-uuid";
      const result = buildJsonSchema(
        [
          makeParam({
            type: "enum",
            enumDatasetId: datasetId,
          }),
        ],
        {
          datasetsById: {
            [datasetId]: { w2: "W2 Income", se: "Self Employed" },
          },
        }
      );

      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.enum).toEqual(["W2 Income", "Self Employed"]);
    });

    it("resolves enum values from datasetsById object (non-string values → keys)", () => {
      const datasetId = "ds-codes-uuid";
      const result = buildJsonSchema(
        [
          makeParam({
            type: "enum",
            enumDatasetId: datasetId,
          }),
        ],
        {
          datasetsById: {
            [datasetId]: { alpha: 1, beta: 2 },
          },
        }
      );

      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.enum).toEqual(["alpha", "beta"]);
    });

    it("falls back to inline enum when dataset not found", () => {
      const result = buildJsonSchema(
        [
          makeParam({
            type: "enum",
            enumDatasetId: "missing-ds",
            enum: ["fallback_a", "fallback_b"],
          }),
        ],
        { datasetsById: {} }
      );

      const props = result.properties as Record<string, Record<string, unknown>>;
      expect(props.field.enum).toEqual(["fallback_a", "fallback_b"]);
    });
  });
});
