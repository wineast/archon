import type { JsonSchema7, SchemaProperty } from "./types";

/**
 * Migrate legacy SchemaProperty[] format to JSON Schema 7.
 * Used for seeder data migration and any remaining old-format data.
 */
export function migrateSchemaProperties(params: SchemaProperty[]): JsonSchema7 {
  const properties: Record<string, JsonSchema7> = {};
  const required: string[] = [];

  for (const param of params) {
    properties[param.name] = migrateProperty(param);
    if (param.required) required.push(param.name);
  }

  return { type: "object", properties, required };
}

function migrateProperty(param: SchemaProperty): JsonSchema7 {
  let schema = migratePropertyInner(param);

  if (param.description) {
    schema.description = param.description;
  }
  if (param.defaultValue !== undefined) {
    schema.default = param.defaultValue;
  }

  // Wrap with nullable
  if (param.nullable) {
    schema = { anyOf: [schema, { type: "null" }] };
  }

  return schema;
}

function migratePropertyInner(param: SchemaProperty): JsonSchema7 {
  switch (param.type) {
    case "string": {
      const s: JsonSchema7 = { type: "string" };
      if (param.minLength != null) s.minLength = param.minLength;
      if (param.maxLength != null) s.maxLength = param.maxLength;
      if (param.pattern) s.pattern = param.pattern;
      if (param.format) s.format = param.format;
      return s;
    }
    case "number": {
      const s: JsonSchema7 = { type: param.integer ? "integer" : "number" };
      if (param.minimum != null) s.minimum = param.minimum;
      if (param.maximum != null) s.maximum = param.maximum;
      if (param.exclusiveMinimum != null) s.exclusiveMinimum = param.exclusiveMinimum;
      if (param.exclusiveMaximum != null) s.exclusiveMaximum = param.exclusiveMaximum;
      if (param.multipleOf != null) s.multipleOf = param.multipleOf;
      return s;
    }
    case "boolean":
      return { type: "boolean" };
    case "null":
      return { type: "null" };
    case "const": {
      const s: JsonSchema7 = {};
      if (param.constValue !== undefined) s.const = param.constValue;
      return s;
    }
    case "enum": {
      const s: JsonSchema7 = { type: "string" };
      if (param.enum && param.enum.length > 0) s.enum = param.enum;
      return s;
    }
    case "object":
      return migrateObjectProperty(param);
    case "array":
      return migrateArrayProperty(param);
    case "union":
      return migrateUnionProperty(param);
    default:
      return { type: "string" };
  }
}

function migrateObjectProperty(param: SchemaProperty): JsonSchema7 {
  // Single schema reference → $ref
  if (param.schemaId) {
    return { $ref: `#/$defs/${param.schemaId}` };
  }

  // Multiple schema references → allOf with $ref
  if (param.schemaIds && param.schemaIds.length > 0) {
    return {
      allOf: param.schemaIds.map((id) => ({ $ref: `#/$defs/${id}` })),
    };
  }

  const s: JsonSchema7 = { type: "object" };

  if (param.properties && param.properties.length > 0) {
    const properties: Record<string, JsonSchema7> = {};
    const required: string[] = [];
    for (const child of param.properties) {
      properties[child.name] = migrateProperty(child);
      if (child.required) required.push(child.name);
    }
    s.properties = properties;
    if (required.length > 0) s.required = required;
  }

  if (param.additionalProperties) {
    s.additionalProperties = migrateProperty(param.additionalProperties);
  }

  return s;
}

function migrateArrayProperty(param: SchemaProperty): JsonSchema7 {
  const s: JsonSchema7 = { type: "array" };

  if (param.tuple && param.prefixItems && param.prefixItems.length > 0) {
    s.prefixItems = param.prefixItems.map(migrateProperty);
  } else if (param.items) {
    s.items = migrateProperty(param.items);
  }

  if (param.minItems != null) s.minItems = param.minItems;
  if (param.maxItems != null) s.maxItems = param.maxItems;
  if (param.uniqueItems) s.uniqueItems = param.uniqueItems;

  return s;
}

function migrateUnionProperty(param: SchemaProperty): JsonSchema7 {
  const s: JsonSchema7 = {};

  if (param.discriminator) s["x-discriminator"] = param.discriminator;
  if (param.discriminatorValues && param.discriminatorValues.length > 0) {
    s["x-discriminatorValues"] = param.discriminatorValues;
  }
  if (param.unionMode) s["x-unionMode"] = param.unionMode;

  const variants = (param.variants ?? []).map(migrateProperty);
  const keyword = param.unionMode === "anyOf" ? "anyOf" : "oneOf";
  s[keyword] = variants;

  return s;
}
