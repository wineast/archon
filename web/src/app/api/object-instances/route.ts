import { NextResponse } from "next/server";
import { db } from "@/db";
import { objectInstances, objectTypes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { extractLabel } from "@/lib/ontology/utils";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");
  const objectTypeId = url.searchParams.get("objectTypeId");

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const conditions = [eq(objectInstances.agentId, agentId)];
  if (objectTypeId) {
    conditions.push(eq(objectInstances.objectTypeId, objectTypeId));
  }

  const rows = await db
    .select()
    .from(objectInstances)
    .where(and(...conditions))
    .orderBy(objectInstances.createdAt);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { agentId, objectTypeId, data } = body;

  if (!agentId || !objectTypeId) {
    return NextResponse.json(
      { error: "agentId and objectTypeId are required" },
      { status: 400 }
    );
  }

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Verify objectType exists and belongs to agent
  const [objType] = await db
    .select()
    .from(objectTypes)
    .where(and(eq(objectTypes.id, objectTypeId), eq(objectTypes.agentId, agentId)));

  if (!objType) {
    return NextResponse.json(
      { error: "Object type not found" },
      { status: 404 }
    );
  }

  const instanceData = (data ?? {}) as Record<string, unknown>;
  const label = extractLabel(instanceData, objType.titleProperty);

  const [row] = await db
    .insert(objectInstances)
    .values({
      agentId,
      objectTypeId,
      label,
      data: instanceData,
      createdBy: ctx.user.clerkId,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
