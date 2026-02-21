import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { db } from "@/db";
import { invitationCodes } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/auth/require-agent-role";

const generateCode = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

export async function GET() {
  const result = await requireSuperAdmin();
  if (result instanceof NextResponse) return result;

  const codes = await db
    .select()
    .from(invitationCodes)
    .orderBy(desc(invitationCodes.createdAt));

  return NextResponse.json(codes);
}

export async function POST(request: Request) {
  const result = await requireSuperAdmin();
  if (result instanceof NextResponse) return result;
  const user = result;

  const body = await request.json().catch(() => ({}));
  const { label, maxUses, expiresAt } = body as {
    label?: string;
    maxUses?: number | null;
    expiresAt?: string | null;
  };

  const [created] = await db
    .insert(invitationCodes)
    .values({
      code: generateCode(),
      label: label ?? "",
      maxUses: maxUses ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
