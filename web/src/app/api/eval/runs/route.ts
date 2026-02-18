import { db } from "@/db";
import { evalRuns } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const runs = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.agentId, agentId))
    .orderBy(desc(evalRuns.createdAt));

  return Response.json(runs);
}
