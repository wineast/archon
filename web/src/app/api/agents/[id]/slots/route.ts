import { NextResponse } from "next/server";
import { db } from "@/db";
import { agentSlots, agents, AGENT_SLOT_KEYS } from "@/db/schema";
import type { AgentSlotKey } from "@/db/schema";
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
  const bindings = await db
    .select({
      slotKey: agentSlots.slotKey,
      targetAgentId: agentSlots.targetAgentId,
      targetAgentName: agents.name,
      targetAgentSlug: agents.slug,
      targetAgentIcon: agents.icon,
    })
    .from(agentSlots)
    .innerJoin(agents, eq(agents.id, agentSlots.targetAgentId))
    .where(eq(agentSlots.agentId, id));

  const bindingMap = new Map(bindings.map((b) => [b.slotKey, b]));

  const result = AGENT_SLOT_KEYS.map((slotKey) => {
    const binding = bindingMap.get(slotKey);

    if (binding) {
      return {
        slotKey,
        agentId: binding.targetAgentId,
        agentName: binding.targetAgentName,
        agentSlug: binding.targetAgentSlug,
        agentIcon: binding.targetAgentIcon,
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
  const { slotKey, targetAgentId } = body as { slotKey: AgentSlotKey; targetAgentId: string };

  if (!slotKey || !(AGENT_SLOT_KEYS as readonly string[]).includes(slotKey)) {
    return NextResponse.json({ error: "Invalid slotKey" }, { status: 400 });
  }

  if (!targetAgentId) {
    return NextResponse.json({ error: "targetAgentId is required" }, { status: 400 });
  }

  const [row] = await db
    .insert(agentSlots)
    .values({ agentId: id, slotKey, targetAgentId })
    .onConflictDoUpdate({
      target: [agentSlots.agentId, agentSlots.slotKey],
      set: { targetAgentId, updatedAt: new Date() },
      where: and(eq(agentSlots.agentId, id), eq(agentSlots.slotKey, slotKey)),
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
  const { slotKey } = body as { slotKey: AgentSlotKey };

  if (!slotKey || !(AGENT_SLOT_KEYS as readonly string[]).includes(slotKey)) {
    return NextResponse.json({ error: "Invalid slotKey" }, { status: 400 });
  }

  await db
    .delete(agentSlots)
    .where(and(eq(agentSlots.agentId, id), eq(agentSlots.slotKey, slotKey)));

  invalidateSlotCache(id);

  return NextResponse.json({ ok: true });
}
