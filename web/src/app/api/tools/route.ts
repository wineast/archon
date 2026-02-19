import { NextResponse } from "next/server";
import { db } from "@/db";
import { tools } from "@/db/schema";
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
    .from(tools)
    .where(eq(tools.agentId, agentId))
    .orderBy(tools.key);
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
    .insert(tools)
    .values({
      agentId,
      key: body.key,
      name: body.name,
      description: body.description,
      parametersSchemaId: body.parametersSchemaId ?? null,
      returnParametersSchemaId: body.returnParametersSchemaId ?? null,
      output: body.output ?? null,
      handler: body.handler ?? null,
      componentId: body.componentId ?? null,
      enabled: body.enabled ?? true,
      executionTarget: body.executionTarget ?? "server",
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
