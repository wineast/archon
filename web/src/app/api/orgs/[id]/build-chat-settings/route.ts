import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { orgs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireOrgRole } from "@/lib/auth/require-org-role";
import { invalidateOrgBuildChatSettingsCache } from "@/lib/orgs/build-chat-settings";

/**
 * GET /api/orgs/[id]/build-chat-settings
 * Returns raw nullable values so the UI can distinguish "default" from "explicitly set".
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;
  const ctx = await requireOrgRole(orgId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const [row] = await db
    .select({
      buildChatModel: orgs.buildChatModel,
      buildChatTemperature: orgs.buildChatTemperature,
    })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);

  return NextResponse.json({
    buildChatModel: row?.buildChatModel ?? null,
    buildChatTemperature: row?.buildChatTemperature ?? null,
  });
}

/**
 * PUT /api/orgs/[id]/build-chat-settings
 * Supports passing null to reset fields to default.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;
  const ctx = await requireOrgRole(orgId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const update: Record<string, unknown> = {};

  if ("buildChatModel" in body) {
    if (body.buildChatModel === null) {
      update.buildChatModel = null;
    } else if (typeof body.buildChatModel === "string" && body.buildChatModel.trim()) {
      update.buildChatModel = body.buildChatModel.trim();
    }
  }

  if ("buildChatTemperature" in body) {
    if (body.buildChatTemperature === null) {
      update.buildChatTemperature = null;
    } else if (typeof body.buildChatTemperature === "number") {
      update.buildChatTemperature = Math.max(0, Math.min(2, body.buildChatTemperature));
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(orgs)
    .set(update)
    .where(eq(orgs.id, orgId))
    .returning({
      buildChatModel: orgs.buildChatModel,
      buildChatTemperature: orgs.buildChatTemperature,
    });

  invalidateOrgBuildChatSettingsCache(orgId);

  return NextResponse.json(updated);
}
