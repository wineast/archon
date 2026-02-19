import { NextResponse } from "next/server";
import { db } from "@/db";
import { schemas } from "@/db/schema";
import type { SchemaRow } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { resolveParameters, detectCycle } from "@/lib/schemas/resolve";

/** Load all schemas for an agent into a Map<id, SchemaRow>. */
async function getAllSchemasMap(agentId: string) {
  const rows = await db
    .select()
    .from(schemas)
    .where(and(eq(schemas.agentId, agentId), isNull(schemas.deletedAt)))
    .orderBy(schemas.key);
  return { rows, map: new Map(rows.map((r) => [r.id, r])) };
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
    // Use a temporary ID for the new schema
    const tempId = "__new__";
    const tempSchema: SchemaRow = {
      id: tempId,
      agentId,
      key: body.key,
      name: body.name,
      description: body.description ?? "",
      parameters: body.parameters ?? [],
      includeSchemaIds,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
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
      includeSchemaIds,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
