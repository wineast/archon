import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/auth/require-agent-role";

export async function GET() {
  const result = await requireSuperAdmin();
  if (result instanceof NextResponse) return result;

  const allUsers = await db
    .select()
    .from(users)
    .orderBy(users.createdAt);

  return NextResponse.json(allUsers);
}
