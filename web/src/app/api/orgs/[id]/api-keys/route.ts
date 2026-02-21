import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { orgApiKeys, BYOK_PROVIDERS } from "@/db/schema";
import type { ByokProvider } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireOrgRole } from "@/lib/auth/require-org-role";
import { encrypt } from "@/lib/crypto";
import { invalidateOrgApiKeyCache } from "@/lib/ai/org-api-keys";

/**
 * GET /api/orgs/[id]/api-keys
 * List org API keys (key masked).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;
  const ctx = await requireOrgRole(orgId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select({
      id: orgApiKeys.id,
      provider: orgApiKeys.provider,
      encryptedKey: orgApiKeys.encryptedKey,
      isActive: orgApiKeys.isActive,
      createdAt: orgApiKeys.createdAt,
      updatedAt: orgApiKeys.updatedAt,
    })
    .from(orgApiKeys)
    .where(eq(orgApiKeys.orgId, orgId));

  // Mask keys: show only last 4 chars
  const masked = rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    maskedKey: "****" + (r.encryptedKey ? r.encryptedKey.slice(-4) : ""),
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return NextResponse.json(masked);
}

/**
 * POST /api/orgs/[id]/api-keys
 * Create or update an API key for a provider (upsert by orgId + provider).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;
  const ctx = await requireOrgRole(orgId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { provider, apiKey } = body as { provider?: string; apiKey?: string };

  if (!provider || !BYOK_PROVIDERS.includes(provider as ByokProvider)) {
    return NextResponse.json(
      { error: `Invalid provider. Must be one of: ${BYOK_PROVIDERS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  const encryptedKey = encrypt(apiKey.trim());

  // Upsert based on orgId + provider
  const [row] = await db
    .insert(orgApiKeys)
    .values({
      orgId,
      provider: provider as ByokProvider,
      encryptedKey,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [orgApiKeys.orgId, orgApiKeys.provider],
      set: { encryptedKey, isActive: true },
    })
    .returning({
      id: orgApiKeys.id,
      provider: orgApiKeys.provider,
      isActive: orgApiKeys.isActive,
    });

  invalidateOrgApiKeyCache(orgId, provider as ByokProvider);

  return NextResponse.json({
    id: row.id,
    provider: row.provider,
    maskedKey: "****" + apiKey.trim().slice(-4),
    isActive: row.isActive,
  });
}
