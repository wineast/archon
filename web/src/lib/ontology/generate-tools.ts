import { db } from "@/db";
import { objectTypes, schemas, tools } from "@/db/schema";
import type { JsonSchema7 } from "@/lib/schemas/types";
import { eq, and, isNull } from "drizzle-orm";

interface GenerateResult {
  created: string[];
  skipped: string[];
}

/**
 * Generate CRUD tools for an object type.
 * Idempotent: skips tools that already exist with the same key.
 * Stores parametersSchema inline as JSONB on each tool.
 */
export async function generateCrudToolsForType(
  objectTypeId: string,
  agentId: string
): Promise<GenerateResult> {
  // Fetch the object type
  const [objType] = await db
    .select()
    .from(objectTypes)
    .where(and(eq(objectTypes.id, objectTypeId), eq(objectTypes.agentId, agentId), isNull(objectTypes.deletedAt)));

  if (!objType) throw new Error("Object type not found");
  if (!objType.schemaId) throw new Error("Object type has no schema assigned");

  // Fetch the schema (properties)
  const [schema] = await db
    .select()
    .from(schemas)
    .where(eq(schemas.id, objType.schemaId));

  if (!schema) throw new Error("Schema not found");

  const typeKey = objType.key;
  const created: string[] = [];
  const skipped: string[] = [];

  // Cast parameters to JsonSchema7 (DB column is already JsonSchema7)
  const schemaParams = schema.parameters as JsonSchema7;

  // Build a copy of the schema's properties with all required removed (for query)
  const queryProperties: Record<string, JsonSchema7> = { ...(schemaParams.properties ?? {}) };

  // Build update properties: id + all original properties (all optional)
  const updateProperties: Record<string, JsonSchema7> = {
    id: { type: "string", description: `ID of the ${objType.name} to update` },
    ...queryProperties,
  };

  // Define the 4 tools to generate
  // For create tool: use $ref to the shared objectType schema (resolved at runtime via defsMap)
  // For others: store derived schemas inline
  const toolDefs = [
    {
      toolKey: `create_${typeKey}`,
      toolName: `create_${typeKey}`,
      toolDescription: `Create a new ${objType.name} instance. ${objType.description}`,
      parametersSchema: { "$ref": `#/$defs/${schema.key}` } as JsonSchema7,
      handler: `async (args, context) => context.ontology.create("${typeKey}", args)`,
    },
    {
      toolKey: `get_${typeKey}`,
      toolName: `get_${typeKey}`,
      toolDescription: `Get a ${objType.name} instance by ID, including its relations.`,
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: `ID of the ${objType.name} to retrieve` },
        },
        required: ["id"],
      } as JsonSchema7,
      handler: `async (args, context) => context.ontology.get("${typeKey}", args.id)`,
    },
    {
      toolKey: `query_${typeKey}s`,
      toolName: `query_${typeKey}s`,
      toolDescription: `Query ${objType.name} instances with optional filters.`,
      parametersSchema: {
        type: "object",
        properties: queryProperties,
        required: [],
      } as JsonSchema7,
      handler: `async (args, context) => context.ontology.query("${typeKey}", args)`,
    },
    {
      toolKey: `update_${typeKey}`,
      toolName: `update_${typeKey}`,
      toolDescription: `Update a ${objType.name} instance by ID. Only provided fields are updated.`,
      parametersSchema: {
        type: "object",
        properties: updateProperties,
        required: ["id"],
      } as JsonSchema7,
      handler: `async (args, context) => { const { id, ...data } = args; return context.ontology.update("${typeKey}", id, data); }`,
    },
  ];

  for (const def of toolDefs) {
    // Check if tool already exists
    const [existingTool] = await db
      .select({ id: tools.id })
      .from(tools)
      .where(and(eq(tools.agentId, agentId), eq(tools.key, def.toolKey), isNull(tools.deletedAt)));

    if (existingTool) {
      skipped.push(def.toolKey);
      continue;
    }

    // Create the tool with inline parametersSchema
    await db.insert(tools).values({
      agentId,
      key: def.toolKey,
      name: def.toolName,
      description: def.toolDescription,
      parametersSchema: def.parametersSchema,
      handler: def.handler,
      enabled: true,
      executionTarget: "server",
    });

    created.push(def.toolKey);
  }

  return { created, skipped };
}
