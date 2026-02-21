import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { memoryConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { logAudit } from "@/lib/audit/log";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(memoryConfigs)
    .where(eq(memoryConfigs.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();

  const [updated] = await db
    .update(memoryConfigs)
    .set({
      ...(body.autoExtract !== undefined && { autoExtract: body.autoExtract }),
      ...(body.extractionPrompt !== undefined && { extractionPrompt: body.extractionPrompt }),
      ...(body.maxMemoriesPerUser !== undefined && { maxMemoriesPerUser: body.maxMemoriesPerUser }),
      ...(body.maxGlobalMemories !== undefined && { maxGlobalMemories: body.maxGlobalMemories }),
      ...(body.injectionMode !== undefined && { injectionMode: body.injectionMode }),
      ...(body.maxInjectedMemories !== undefined && { maxInjectedMemories: body.maxInjectedMemories }),
      ...(body.decayEnabled !== undefined && { decayEnabled: body.decayEnabled }),
      ...(body.decayDays !== undefined && { decayDays: body.decayDays }),
      ...(body.memoryTypeDefs !== undefined && { memoryTypeDefs: body.memoryTypeDefs }),
    })
    .where(eq(memoryConfigs.id, id))
    .returning();

  after(async () => {
    await logAudit({
      agentId: existing.agentId!,
      userId: ctx.user.id,
      action: "updated",
      resourceType: "memory_config",
      resourceId: id,
      resourceKey: existing.id,
      resourceName: "memory_config",
    });
  });

  return NextResponse.json(updated);
}
