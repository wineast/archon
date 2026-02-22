import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureUser } from "@/lib/auth/ensure-user";
import { initiateAccountDeletion } from "@/lib/auth/account-deletion";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await ensureUser(userId);
  return Response.json(user);
}

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: { nickname?: string; bio?: string } = await req.json();

  await ensureUser(userId);

  const [updated] = await db
    .update(users)
    .set({
      nickname: body.nickname,
      bio: body.bio,
    })
    .where(eq(users.clerkId, userId))
    .returning();

  return Response.json(updated);
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureUser(userId);
  const updated = await initiateAccountDeletion(userId);
  return Response.json(updated);
}
