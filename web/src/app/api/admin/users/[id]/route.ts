import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/auth/require-agent-role";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await requireSuperAdmin();
  if (currentUser instanceof NextResponse) return currentUser;

  const { id } = await params;
  const body = await req.json();
  const { platformRole } = body as { platformRole: string };

  if (!platformRole || !["user", "super_admin"].includes(platformRole)) {
    return NextResponse.json({ error: "Invalid platformRole" }, { status: 400 });
  }

  // Cannot remove own super_admin
  if (currentUser.id === id && platformRole !== "super_admin") {
    return NextResponse.json(
      { error: "Cannot remove your own super_admin role" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(users)
    .set({ platformRole: platformRole as "user" | "super_admin" })
    .where(eq(users.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
