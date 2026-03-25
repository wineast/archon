import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { invitationCodes, invitationCodeUsages } from "@/db/schema";
import { requireAuth } from "@/lib/auth/require-agent-role";

export async function POST(request: Request) {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  const user = result;

  const body = await request.json().catch(() => ({}));
  const code = (body.code as string)?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json(
      { error: "Please enter an invitation code" },
      { status: 400 },
    );
  }

  try {
    await db.transaction(async (tx) => {
      // Lock the row for update
      const [row] = await tx
        .select()
        .from(invitationCodes)
        .where(
          and(
            eq(invitationCodes.code, code),
            eq(invitationCodes.isActive, true),
          ),
        )
        .for("update")
        .limit(1);

      if (!row) {
        throw new Error("Invalid invitation code");
      }

      if (row.expiresAt && row.expiresAt < new Date()) {
        throw new Error("This invitation code has expired");
      }

      if (row.maxUses !== null && row.usedCount >= row.maxUses) {
        throw new Error("This invitation code has reached its usage limit");
      }

      // Insert usage record (unique constraint ensures idempotency)
      await tx
        .insert(invitationCodeUsages)
        .values({ codeId: row.id, userId: user.id })
        .onConflictDoNothing();

      // Increment usedCount
      await tx
        .update(invitationCodes)
        .set({ usedCount: sql`${invitationCodes.usedCount} + 1` })
        .where(eq(invitationCodes.id, row.id));
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    // Check if it's a known validation error
    if (
      e instanceof Error &&
      [
        "Invalid invitation code",
        "This invitation code has expired",
        "This invitation code has reached its usage limit",
      ].includes(e.message)
    ) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("consume invitation code failed:", e);
    return NextResponse.json(
      { error: "Failed to redeem invitation code" },
      { status: 500 },
    );
  }
}
