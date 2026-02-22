import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { orgApiKeys } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireOrgRole } from "@/lib/auth/require-org-role";

/**
 * GET /api/orgs/[id]/configured-providers
 * Returns list of provider names that have active API keys configured.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;
  const ctx = await requireOrgRole(orgId, "member");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select({ provider: orgApiKeys.provider })
    .from(orgApiKeys)
    .where(and(eq(orgApiKeys.orgId, orgId), eq(orgApiKeys.isActive, true)));

  const providers = rows.map((r) => r.provider);
  return NextResponse.json(providers);
}
