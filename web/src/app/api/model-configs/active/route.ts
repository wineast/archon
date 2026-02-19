import { NextResponse } from "next/server";
import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const [active] = await db
    .select()
    .from(modelConfigs)
    .where(and(eq(modelConfigs.agentId, agentId), eq(modelConfigs.isActive, true), isNull(modelConfigs.deletedAt)))
    .limit(1);

  if (!active) {
    return NextResponse.json(null);
  }

  return NextResponse.json(active);
}
