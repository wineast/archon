import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { chatConfigs } from "@/db/schema";
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
    .from(chatConfigs)
    .where(eq(chatConfigs.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId!, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();

  const [updated] = await db
    .update(chatConfigs)
    .set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.welcomeTitle !== undefined && { welcomeTitle: body.welcomeTitle }),
      ...(body.welcomeIcon !== undefined && { welcomeIcon: body.welcomeIcon }),
      ...(body.quickActions !== undefined && { quickActions: body.quickActions }),
      ...(body.placeholder !== undefined && { placeholder: body.placeholder }),
      ...(body.suggestions !== undefined && { suggestions: body.suggestions }),
    })
    .where(eq(chatConfigs.id, id))
    .returning();

  after(async () => {
    await logAudit({
      agentId: existing.agentId!,
      userId: ctx.user.id,
      action: "updated",
      resourceType: "chat_config",
      resourceId: id,
      resourceKey: existing.id,
      resourceName: existing.title || "chat_config",
    });
  });

  return NextResponse.json(updated);
}
