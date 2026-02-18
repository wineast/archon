import { NextResponse } from "next/server";
import { db } from "@/db";
import { templateVars } from "@/db/schema";
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
    .from(templateVars)
    .where(eq(templateVars.agentId, agentId))
    .orderBy(asc(templateVars.key));
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
    .insert(templateVars)
    .values({
      agentId,
      key: body.key ?? "",
      value: body.value ?? "",
      type: body.type ?? "text",
      isArray: body.isArray ?? false,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
