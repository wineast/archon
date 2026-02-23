import { NextResponse } from "next/server";
import { db } from "@/db";
import { agentSlotOverrides, agents, SLOT_KEYS } from "@/db/schema";
import type { SlotKey } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { invalidateSlotCache } from "@/lib/slots";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ctx = await requireAgentRole(id, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  // Get bindings for this agent
  const overrides = await db
    .select({
      slotKey: agentSlotOverrides.slotKey,
      targetAgentId: agentSlotOverrides.targetAgentId,
      targetAgentName: agents.name,
      targetAgentSlug: agents.slug,
      targetAgentIcon: agents.icon,
    })
    .from(agentSlotOverrides)
    .innerJoin(agents, eq(agents.id, agentSlotOverrides.targetAgentId))
    .where(eq(agentSlotOverrides.agentId, id));

  const overrideMap = new Map(overrides.map((o) => [o.slotKey, o]));

  const result = SLOT_KEYS.map((slotKey) => {
    const override = overrideMap.get(slotKey);

    if (override) {
      return {
        slotKey,
        agentId: override.targetAgentId,
        agentName: override.targetAgentName,
        agentSlug: override.targetAgentSlug,
        agentIcon: override.targetAgentIcon,
      };
    }

    return {
      slotKey,
      agentId: null,
      agentName: "",
      agentSlug: "",
      agentIcon: "",
    };
  });

  return NextResponse.json(result);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ctx = await requireAgentRole(id, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { slotKey, targetAgentId } = body as { slotKey: SlotKey; targetAgentId: string };

  if (!slotKey || !(SLOT_KEYS as readonly string[]).includes(slotKey)) {
    return NextResponse.json({ error: "Invalid slotKey" }, { status: 400 });
  }

  if (!targetAgentId) {
    return NextResponse.json({ error: "targetAgentId is required" }, { status: 400 });
  }

  const [row] = await db
    .insert(agentSlotOverrides)
    .values({ agentId: id, slotKey, targetAgentId })
    .onConflictDoUpdate({
      target: [agentSlotOverrides.agentId, agentSlotOverrides.slotKey],
      set: { targetAgentId, updatedAt: new Date() },
      where: and(eq(agentSlotOverrides.agentId, id), eq(agentSlotOverrides.slotKey, slotKey)),
    })
    .returning();

  invalidateSlotCache(id);

  return NextResponse.json(row);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ctx = await requireAgentRole(id, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { slotKey } = body as { slotKey: SlotKey };

  if (!slotKey || !(SLOT_KEYS as readonly string[]).includes(slotKey)) {
    return NextResponse.json({ error: "Invalid slotKey" }, { status: 400 });
  }

  await db
    .delete(agentSlotOverrides)
    .where(and(eq(agentSlotOverrides.agentId, id), eq(agentSlotOverrides.slotKey, slotKey)));

  invalidateSlotCache(id);

  return NextResponse.json({ ok: true });
}
