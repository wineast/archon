import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function ensureUser(clerkId: string) {
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
