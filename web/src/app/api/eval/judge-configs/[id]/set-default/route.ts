import { NextResponse } from "next/server";
import { db } from "@/db";
import { evalJudgeConfigs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function PUT(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(evalJudgeConfigs)
    .where(eq(evalJudgeConfigs.id, id));

  if (!existing) {
    return NextResponse.json(
      { error: "Judge config not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Clear all defaults for this agent, then set the target as default
  await db
    .update(evalJudgeConfigs)
    .set({ isDefault: false })
    .where(eq(evalJudgeConfigs.agentId, existing.agentId!));

  const [updated] = await db
    .update(evalJudgeConfigs)
    .set({ isDefault: true })
    .where(eq(evalJudgeConfigs.id, id))
    .returning();

  return NextResponse.json(updated);
}
