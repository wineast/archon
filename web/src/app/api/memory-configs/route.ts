import { NextResponse } from "next/server";
import { db } from "@/db";
import { memoryConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const [row] = await db
    .select()
    .from(memoryConfigs)
    .where(eq(memoryConfigs.agentId, agentId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "No memory config" }, { status: 404 });
  }

  return NextResponse.json(row);
}
