import { NextResponse } from "next/server";
import { db } from "@/db";
import { objectRelations } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select()
    .from(objectRelations)
    .where(and(eq(objectRelations.agentId, agentId), isNull(objectRelations.deletedAt)))
    .orderBy(objectRelations.order, objectRelations.key);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const agentId = body.agentId;
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const [row] = await db
    .insert(objectRelations)
    .values({
      agentId,
      key: body.key,
      name: body.name,
      description: body.description ?? "",
      sourceTypeId: body.sourceTypeId,
      targetTypeId: body.targetTypeId,
      relationType: body.relationType,
      inverseName: body.inverseName ?? "",
      order: body.order ?? 0,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
