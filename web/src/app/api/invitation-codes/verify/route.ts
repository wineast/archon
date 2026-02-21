import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { invitationCodes } from "@/db/schema";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = (body.code as string)?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json(
      { valid: false, error: "请输入邀请码" },
      { status: 400 }
    );
  }

  const [row] = await db
    .select()
    .from(invitationCodes)
    .where(
      and(
        eq(invitationCodes.code, code),
        eq(invitationCodes.isActive, true)
      )
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ valid: false, error: "邀请码无效" });
  }

  if (row.expiresAt && row.expiresAt < new Date()) {
    return NextResponse.json({ valid: false, error: "邀请码已过期" });
  }

  if (row.maxUses !== null && row.usedCount >= row.maxUses) {
    return NextResponse.json({ valid: false, error: "邀请码已用完" });
  }

  return NextResponse.json({ valid: true });
}
