import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { tools } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { logAudit } from "@/lib/audit/log";

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
    .where(and(eq(tools.agentId, agentId), isNull(tools.deletedAt)))
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
      parametersSchema: body.parametersSchema ?? null,
      returnParametersSchema: body.returnParametersSchema ?? null,
      handler: body.handler ?? null,
      url: body.url ?? null,
      componentId: body.componentId ?? null,
      enabled: body.enabled ?? true,
      executionTarget: body.executionTarget ?? "server",
    })
    .returning();

  after(async () => {
    await logAudit({
      agentId,
      userId: ctx.user.id,
      action: "created",
      resourceType: "tool",
      resourceId: row.id,
      resourceKey: row.key,
      resourceName: row.name,
    });
  });

  return NextResponse.json(row, { status: 201 });
}
