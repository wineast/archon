import { NextResponse } from "next/server";
import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [target] = await db
    .select()
    .from(modelConfigs)
    .where(eq(modelConfigs.id, id));

  if (!target) {
    return NextResponse.json(
      { error: "Model config not found" },
      { status: 404 }
    );
  }

  const ctx = await requireAgentRole(target.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Deactivate all configs for this agent, then activate target
  await db
    .update(modelConfigs)
    .set({ isActive: false })
    .where(and(eq(modelConfigs.agentId, target.agentId!), eq(modelConfigs.isActive, true)));

  const [activated] = await db
    .update(modelConfigs)
    .set({ isActive: true })
    .where(eq(modelConfigs.id, id))
    .returning();

  return NextResponse.json(activated);
}
