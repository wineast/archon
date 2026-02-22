import { NextResponse } from "next/server";
import { db } from "@/db";
import { judgeConfigs } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

/** GET ?agentId=X — get judge configs for a specific agent (cross-agent query for eval form) */
export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select()
    .from(judgeConfigs)
    .where(and(eq(judgeConfigs.agentId, agentId), isNull(judgeConfigs.deletedAt)))
    .orderBy(judgeConfigs.createdAt);

  return NextResponse.json(rows);
}
