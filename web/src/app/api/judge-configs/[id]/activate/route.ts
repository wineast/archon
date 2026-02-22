import { NextResponse } from "next/server";
import { db } from "@/db";
import { judgeConfigs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [target] = await db
    .select()
    .from(judgeConfigs)
    .where(and(eq(judgeConfigs.id, id), isNull(judgeConfigs.deletedAt)));

  if (!target) {
    return NextResponse.json(
      { error: "Judge config not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(target.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Deactivate all configs for this agent, then activate target
  await db
    .update(judgeConfigs)
    .set({ isActive: false })
    .where(and(eq(judgeConfigs.agentId, target.agentId!), eq(judgeConfigs.isActive, true)));

  const [activated] = await db
    .update(judgeConfigs)
    .set({ isActive: true })
    .where(eq(judgeConfigs.id, id))
    .returning();

  return NextResponse.json(activated);
}
