import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { memories } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { logAudit } from "@/lib/audit/log";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const userId = url.searchParams.get("userId");
  const conditions = [eq(memories.agentId, agentId), isNull(memories.deletedAt)];
  if (userId) {
    conditions.push(eq(memories.userId, userId));
  }

  const rows = await db
    .select()
    .from(memories)
    .where(and(...conditions))
    .orderBy(memories.createdAt);

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
    .insert(memories)
    .values({
      agentId,
      type: body.type,
      content: body.content,
      userId: body.userId ?? null,
      sessionId: body.sessionId ?? null,
      importance: body.importance ?? 0.5,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      metadata: body.metadata ?? null,
    })
    .returning();

  after(async () => {
    await logAudit({
      agentId,
      userId: ctx.user.id,
      action: "created",
      resourceType: "memory",
      resourceId: row.id,
      resourceKey: row.type,
      resourceName: row.content.slice(0, 50),
    });
  });

  return NextResponse.json(row, { status: 201 });
}
