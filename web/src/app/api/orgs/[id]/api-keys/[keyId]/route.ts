import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { orgApiKeys } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireOrgRole } from "@/lib/auth/require-org-role";
import { invalidateOrgApiKeyCache } from "@/lib/ai/org-api-keys";

/**
 * DELETE /api/orgs/[id]/api-keys/[keyId]
 * Hard-delete an org API key.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  const { id: orgId, keyId } = await params;
  const ctx = await requireOrgRole(orgId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const [deleted] = await db
    .delete(orgApiKeys)
    .where(and(eq(orgApiKeys.id, keyId), eq(orgApiKeys.orgId, orgId)))
    .returning({ provider: orgApiKeys.provider });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  invalidateOrgApiKeyCache(orgId);

  return NextResponse.json({ ok: true });
}
