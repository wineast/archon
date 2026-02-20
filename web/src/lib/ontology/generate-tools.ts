import { db } from "@/db";
import { objectTypes, schemas, tools } from "@/db/schema";
import type { SchemaProperty } from "@/lib/schemas/types";
import { eq, and, isNull } from "drizzle-orm";

interface GenerateResult {
  created: string[];
  skipped: string[];
}

/**
 * Generate CRUD tools for an object type.
 * Idempotent: skips tools/schemas that already exist with the same key.
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

  // Define the 4 tools to generate
  const toolDefs = [
    {
      toolKey: `create_${typeKey}`,
      toolName: `Create ${objType.name}`,
      toolDescription: `Create a new ${objType.name} instance. ${objType.description}`,
      schemaKey: null, // reuse objectType's schema
      schemaParams: null,
      handler: `async (args, context) => context.ontology.create("${typeKey}", args)`,
    },
    {
      toolKey: `get_${typeKey}`,
      toolName: `Get ${objType.name}`,
      toolDescription: `Get a ${objType.name} instance by ID, including its relations.`,
      schemaKey: `_auto_${typeKey}_get`,
      schemaParams: [
        {
          id: "id",
          name: "id",
          type: "string" as const,
          description: `ID of the ${objType.name} to retrieve`,
          required: true,
        },
      ],
      handler: `async (args, context) => context.ontology.get("${typeKey}", args.id)`,
    },
    {
      toolKey: `query_${typeKey}s`,
      toolName: `Query ${objType.name}s`,
      toolDescription: `Query ${objType.name} instances with optional filters.`,
      schemaKey: `_auto_${typeKey}_query`,
      schemaParams: schema.parameters.map(
        (p): SchemaProperty => ({
          ...p,
          required: false,
        })
      ),
      handler: `async (args, context) => context.ontology.query("${typeKey}", args)`,
    },
    {
      toolKey: `update_${typeKey}`,
      toolName: `Update ${objType.name}`,
      toolDescription: `Update a ${objType.name} instance by ID. Only provided fields are updated.`,
      schemaKey: `_auto_${typeKey}_update`,
      schemaParams: [
        {
          id: "id",
          name: "id",
          type: "string" as const,
          description: `ID of the ${objType.name} to update`,
          required: true,
        },
        ...schema.parameters.map(
          (p): SchemaProperty => ({
            ...p,
            required: false,
          })
        ),
      ],
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

    // Create derived schema if needed
    let parametersSchemaId: string | null = null;
    if (def.schemaKey && def.schemaParams) {
      // Check if schema already exists
      const [existingSchema] = await db
        .select({ id: schemas.id })
        .from(schemas)
        .where(and(eq(schemas.agentId, agentId), eq(schemas.key, def.schemaKey), isNull(schemas.deletedAt)));

      if (existingSchema) {
        parametersSchemaId = existingSchema.id;
      } else {
        const [newSchema] = await db
          .insert(schemas)
          .values({
            agentId,
            key: def.schemaKey,
            name: `${def.toolName} Parameters`,
            description: `Auto-generated schema for ${def.toolKey}`,
            parameters: def.schemaParams,
          })
          .returning({ id: schemas.id });
        parametersSchemaId = newSchema.id;
      }
    } else {
      // Reuse the objectType's schema directly
      parametersSchemaId = objType.schemaId;
    }

    // Create the tool
    await db.insert(tools).values({
      agentId,
      key: def.toolKey,
      name: def.toolName,
      description: def.toolDescription,
      parametersSchemaId,
      handler: def.handler,
      enabled: true,
      executionTarget: "server",
    });

    created.push(def.toolKey);
  }

  return { created, skipped };
}
