import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { orgSlots, embedTokens } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireOrgRole } from "@/lib/auth/require-org-role";
import { ensureOrgDefaults } from "@/lib/slots/ensure-org-defaults";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;
  const ctx = await requireOrgRole(orgId, "member");
  if (ctx instanceof NextResponse) return ctx;

  // Look up support slot
  let [slot] = await db
    .select({ agentId: orgSlots.agentId })
    .from(orgSlots)
    .where(and(eq(orgSlots.orgId, orgId), eq(orgSlots.slotKey, "support")))
    .limit(1);

  // If no slot, ensure defaults are created (edge case: org created before support slot existed)
  if (!slot) {
    await ensureOrgDefaults(orgId);
    [slot] = await db
      .select({ agentId: orgSlots.agentId })
      .from(orgSlots)
      .where(and(eq(orgSlots.orgId, orgId), eq(orgSlots.slotKey, "support")))
      .limit(1);
  }

  if (!slot) return NextResponse.json(null);

  // Find first active embed token for the support agent
  const [token] = await db
    .select({ token: embedTokens.token })
    .from(embedTokens)
    .where(
      and(eq(embedTokens.agentId, slot.agentId), eq(embedTokens.isActive, true))
    )
    .limit(1);

  if (!token) return NextResponse.json(null);

  return NextResponse.json({ agentId: slot.agentId, token: token.token });
}
