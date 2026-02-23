import { NextResponse } from "next/server";
import { db } from "@/db";
import { orgSlots, agents, embedTokens, ORG_SLOT_KEYS } from "@/db/schema";
import type { OrgSlotKey } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireOrgRole } from "@/lib/auth/require-org-role";
import { invalidateSlotCache } from "@/lib/slots";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;

  const ctx = await requireOrgRole(orgId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const bindings = await db
    .select({
      slotKey: orgSlots.slotKey,
      targetAgentId: orgSlots.targetAgentId,
      targetAgentName: agents.name,
      targetAgentSlug: agents.slug,
      targetAgentIcon: agents.icon,
    })
    .from(orgSlots)
    .innerJoin(agents, eq(agents.id, orgSlots.targetAgentId))
    .where(eq(orgSlots.orgId, orgId));

  const bindingMap = new Map(bindings.map((b) => [b.slotKey, b]));

  const result = ORG_SLOT_KEYS.map((slotKey) => {
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
  const { id: orgId } = await params;

  const ctx = await requireOrgRole(orgId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { slotKey, targetAgentId } = body as { slotKey: OrgSlotKey; targetAgentId: string };

  if (!slotKey || !(ORG_SLOT_KEYS as readonly string[]).includes(slotKey)) {
    return NextResponse.json({ error: "Invalid slotKey" }, { status: 400 });
  }

  if (!targetAgentId) {
    return NextResponse.json({ error: "targetAgentId is required" }, { status: 400 });
  }

  // For support slot: ensure the target agent has an active embed token
  if (slotKey === "support") {
    const [existingToken] = await db
      .select({ id: embedTokens.id })
      .from(embedTokens)
      .where(and(eq(embedTokens.agentId, targetAgentId), eq(embedTokens.isActive, true)))
      .limit(1);

    if (!existingToken) {
      await db.insert(embedTokens).values({
        agentId: targetAgentId,
        name: "Support Widget",
        token: `et_${nanoid(32)}`,
        allowedOrigins: [],
        isActive: true,
      });
    }
  }

  const [row] = await db
    .insert(orgSlots)
    .values({ orgId, slotKey, targetAgentId })
    .onConflictDoUpdate({
      target: [orgSlots.orgId, orgSlots.slotKey],
      set: { targetAgentId, updatedAt: new Date() },
      where: and(eq(orgSlots.orgId, orgId), eq(orgSlots.slotKey, slotKey)),
    })
    .returning();

  invalidateSlotCache(orgId);

  return NextResponse.json(row);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;

  const ctx = await requireOrgRole(orgId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { slotKey } = body as { slotKey: OrgSlotKey };

  if (!slotKey || !(ORG_SLOT_KEYS as readonly string[]).includes(slotKey)) {
    return NextResponse.json({ error: "Invalid slotKey" }, { status: 400 });
  }

  await db
    .delete(orgSlots)
    .where(and(eq(orgSlots.orgId, orgId), eq(orgSlots.slotKey, slotKey)));

  invalidateSlotCache(orgId);

  return NextResponse.json({ ok: true });
}
