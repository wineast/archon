import { NextResponse } from "next/server";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
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
    .from(datasets)
    .where(eq(datasets.agentId, agentId))
    .orderBy(asc(datasets.key));
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
    .insert(datasets)
    .values({
      agentId,
      key: body.key,
      name: body.name,
      description: body.description ?? "",
      layer: body.layer ?? 0,
      data: body.data,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
