import { NextResponse } from "next/server";
import { db } from "@/db";
import { objectTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
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
    .from(objectTypes)
    .where(eq(objectTypes.agentId, agentId))
    .orderBy(objectTypes.order, objectTypes.key);

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
    .insert(objectTypes)
    .values({
      agentId,
      key: body.key,
      name: body.name,
      description: body.description ?? "",
      icon: body.icon ?? "box",
      color: body.color ?? "#6366f1",
      schemaId: body.schemaId ?? null,
      titleProperty: body.titleProperty ?? null,
      source: body.source ?? "internal",
      externalConfig: body.externalConfig ?? null,
      order: body.order ?? 0,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
