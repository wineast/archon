import { NextResponse } from "next/server";
import { db } from "@/db";
import { agentSlotOverrides, agents, orgSlots, SLOT_KEYS } from "@/db/schema";
import type { SlotKey } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { invalidateSlotCache } from "@/lib/slots";
import { SLOT_DEFS } from "@/lib/slots/constants";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ctx = await requireAgentRole(id, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  // Get the agent's orgId
  const [agent] = await db
    .select({ orgId: agents.orgId })
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1);

  if (!agent) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Get overrides for this agent
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

  // Get org defaults
  const orgDefaults = await db
    .select({
      slotKey: orgSlots.slotKey,
      agentId: orgSlots.agentId,
      agentName: agents.name,
      agentSlug: agents.slug,
      agentIcon: agents.icon,
    })
    .from(orgSlots)
    .innerJoin(agents, eq(agents.id, orgSlots.agentId))
    .where(eq(orgSlots.orgId, agent.orgId));

  const overrideMap = new Map(overrides.map((o) => [o.slotKey, o]));
  const orgDefaultMap = new Map(orgDefaults.map((d) => [d.slotKey, d]));

  const result = SLOT_KEYS.map((slotKey) => {
    const override = overrideMap.get(slotKey);
    const orgDefault = orgDefaultMap.get(slotKey);
    const def = SLOT_DEFS[slotKey];

    if (override) {
      return {
        slotKey,
        source: "override" as const,
        agentId: override.targetAgentId,
        agentName: override.targetAgentName,
        agentSlug: override.targetAgentSlug,
        agentIcon: override.targetAgentIcon,
      };
    }

    if (orgDefault) {
      return {
        slotKey,
        source: "org" as const,
        agentId: orgDefault.agentId,
        agentName: orgDefault.agentName,
        agentSlug: orgDefault.agentSlug,
        agentIcon: orgDefault.agentIcon,
      };
    }

    return {
      slotKey,
      source: "default" as const,
      agentId: null,
      agentName: def.defaultAgentName,
      agentSlug: def.defaultAgentSlug,
      agentIcon: def.defaultAgentIcon,
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
