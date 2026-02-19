import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { schemas, schemaIncludes } from "@/db/schema";
import type { SchemaWithIncludes } from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { resolveParameters, detectCycle } from "@/lib/schemas/resolve";
import { logAudit } from "@/lib/audit/log";

/** Load all schemas for an agent with their includes, returning a Map<id, SchemaWithIncludes>. */
async function getAllSchemasMap(agentId: string) {
  const rows = await db
    .select()
    .from(schemas)
    .where(eq(schemas.agentId, agentId))
    .orderBy(schemas.key);

  // Load all includes for these schemas
  const includeRows = rows.length > 0
    ? await db
        .select()
        .from(schemaIncludes)
        .where(inArray(schemaIncludes.schemaId, rows.map((r) => r.id)))
        .orderBy(asc(schemaIncludes.position))
    : [];

  // Build includes map
  const includesBySchemaId = new Map<string, string[]>();
  for (const row of includeRows) {
    const arr = includesBySchemaId.get(row.schemaId) ?? [];
    arr.push(row.includeSchemaId);
    includesBySchemaId.set(row.schemaId, arr);
  }

  const withIncludes: SchemaWithIncludes[] = rows.map((r) => ({
    ...r,
    includeSchemaIds: includesBySchemaId.get(r.id) ?? [],
  }));

  return {
    rows: withIncludes,
    map: new Map(withIncludes.map((r) => [r.id, r])),
  };
}

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const { rows, map } = await getAllSchemasMap(agentId);

  const result = rows.map((row) => ({
    ...row,
    resolvedParameters: resolveParameters(row, map),
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const body = await req.json();
  const agentId = body.agentId;
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const includeSchemaIds: string[] = body.includeSchemaIds ?? [];

  // Validate cycle if includes are provided
  if (includeSchemaIds.length > 0) {
    const { map } = await getAllSchemasMap(agentId);
    const tempId = "__new__";
    const tempSchema: SchemaWithIncludes = {
      id: tempId,
      agentId,
      key: body.key,
      name: body.name,
      description: body.description ?? "",
      parameters: body.parameters ?? [],
      includeSchemaIds,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    map.set(tempId, tempSchema);
    if (detectCycle(tempId, includeSchemaIds, map)) {
      return NextResponse.json(
        { error: "Circular include detected" },
        { status: 400 }
      );
    }
  }

  const [row] = await db
    .insert(schemas)
    .values({
      agentId,
      key: body.key,
      name: body.name,
      description: body.description ?? "",
      parameters: body.parameters ?? [],
    })
    .returning();

  // Insert schema includes
  if (includeSchemaIds.length > 0) {
    await db.insert(schemaIncludes).values(
      includeSchemaIds.map((includeId, i) => ({
        schemaId: row.id,
        includeSchemaId: includeId,
        position: i,
      }))
    );
  }

  after(async () => {
    await logAudit({
      agentId,
      userId: ctx.user.id,
      action: "created",
      resourceType: "schema",
      resourceId: row.id,
      resourceKey: row.key,
      resourceName: row.name,
    });
  });

  return NextResponse.json({ ...row, includeSchemaIds }, { status: 201 });
}
