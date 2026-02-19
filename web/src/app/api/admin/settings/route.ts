import { NextResponse } from "next/server";
import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/auth/require-agent-role";
import { invalidatePlatformSettingsCache } from "@/lib/platform-settings/queries";

export async function GET() {
  const result = await requireSuperAdmin();
  if (result instanceof NextResponse) return result;

  // Upsert singleton to ensure it exists
  const [row] = await db
    .insert(platformSettings)
    .values({ id: "singleton" })
    .onConflictDoNothing()
    .returning();

  // If onConflictDoNothing returned nothing, row already exists — fetch it
  if (!row) {
    const [existing] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.id, "singleton"));
    return NextResponse.json(existing);
  }

  return NextResponse.json(row);
}

export async function PUT(request: Request) {
  const result = await requireSuperAdmin();
  if (result instanceof NextResponse) return result;

  const body = await request.json();
  const update: Record<string, unknown> = {};

  if (typeof body.buildChatModel === "string" && body.buildChatModel.trim()) {
    update.buildChatModel = body.buildChatModel.trim();
  }
  if (typeof body.buildChatTemperature === "number") {
    update.buildChatTemperature = Math.max(0, Math.min(2, body.buildChatTemperature));
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(platformSettings)
    .set(update)
    .where(eq(platformSettings.id, "singleton"))
    .returning();

  invalidatePlatformSettingsCache();

  return NextResponse.json(updated);
}
