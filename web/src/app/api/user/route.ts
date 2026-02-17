import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

async function ensureUser(clerkId: string) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId));

  if (existing) return existing;

  // Auto-create from Clerk profile
  const clerk = await currentUser();
  const [created] = await db
    .insert(users)
    .values({
      clerkId,
      email: clerk?.emailAddresses[0]?.emailAddress ?? "",
      nickname:
        [clerk?.firstName, clerk?.lastName].filter(Boolean).join(" ") || null,
      avatarUrl: clerk?.imageUrl ?? null,
    })
    .returning();

  return created;
}

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
