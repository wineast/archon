import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { invitationCodes } from "@/db/schema";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = (body.code as string)?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json(
      { valid: false, error: "Please enter an invitation code" },
      { status: 400 },
    );
  }

  const [row] = await db
    .select()
    .from(invitationCodes)
    .where(
      and(eq(invitationCodes.code, code), eq(invitationCodes.isActive, true)),
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({
      valid: false,
      error: "Invalid invitation code",
    });
  }

  if (row.expiresAt && row.expiresAt < new Date()) {
    return NextResponse.json({
      valid: false,
      error: "This invitation code has expired",
    });
  }

  if (row.maxUses !== null && row.usedCount >= row.maxUses) {
    return NextResponse.json({
      valid: false,
      error: "This invitation code has reached its usage limit",
    });
  }

  return NextResponse.json({ valid: true });
}
