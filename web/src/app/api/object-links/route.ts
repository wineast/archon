import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  objectLinks,
  objectRelations,
  objectInstances,
} from "@/db/schema";
import { eq, or, and } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");
  const instanceId = url.searchParams.get("instanceId");

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const conditions = [eq(objectLinks.agentId, agentId)];
  if (instanceId) {
    conditions.push(
      or(
        eq(objectLinks.sourceId, instanceId),
        eq(objectLinks.targetId, instanceId)
      )!
    );
  }

  const rows = await db
    .select()
    .from(objectLinks)
    .where(and(...conditions))
    .orderBy(objectLinks.createdAt);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { agentId, relationId, sourceId, targetId, metadata } = body;

  if (!agentId || !relationId || !sourceId || !targetId) {
    return NextResponse.json(
      { error: "agentId, relationId, sourceId, targetId are required" },
      { status: 400 }
    );
  }

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Verify relation exists
  const [relation] = await db
    .select()
    .from(objectRelations)
    .where(eq(objectRelations.id, relationId));

  if (!relation) {
    return NextResponse.json(
      { error: "Relation not found" },
      { status: 404 }
    );
  }

  // Verify source and target instances exist and match the relation types
  const [source] = await db
    .select()
    .from(objectInstances)
    .where(eq(objectInstances.id, sourceId));

  const [target] = await db
    .select()
    .from(objectInstances)
    .where(eq(objectInstances.id, targetId));

  if (!source || !target) {
    return NextResponse.json(
      { error: "Source or target instance not found" },
      { status: 404 }
    );
  }

  if (source.objectTypeId !== relation.sourceTypeId) {
    return NextResponse.json(
      { error: "Source instance type does not match relation's sourceTypeId" },
      { status: 400 }
    );
  }

  if (target.objectTypeId !== relation.targetTypeId) {
    return NextResponse.json(
      { error: "Target instance type does not match relation's targetTypeId" },
      { status: 400 }
    );
  }

  const [row] = await db
    .insert(objectLinks)
    .values({
      agentId,
      relationId,
      sourceId,
      targetId,
      metadata: metadata ?? null,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
