import { db } from "@/db";
import { users, orgs, orgMembers } from "@/db/schema";
import { eq, and, lt, isNotNull } from "drizzle-orm";
import { createClerkClient } from "@clerk/nextjs/server";

export const ACCOUNT_DELETION_GRACE_DAYS = 7;

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

/** Mark user for deletion (soft delete). */
export async function initiateAccountDeletion(clerkId: string) {
  const [updated] = await db
    .update(users)
    .set({ deletedAt: new Date() })
    .where(eq(users.clerkId, clerkId))
    .returning();

  if (!updated) throw new Error("User not found");
  return updated;
}

/** Cancel a pending account deletion. */
export async function cancelAccountDeletion(clerkId: string) {
  const [updated] = await db
    .update(users)
    .set({ deletedAt: null })
    .where(eq(users.clerkId, clerkId))
    .returning();

  if (!updated) throw new Error("User not found");
  return updated;
}

/** Permanently delete users whose grace period has expired. */
export async function cleanupDeletedUsers() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ACCOUNT_DELETION_GRACE_DAYS);

  const expiredUsers = await db
    .select()
    .from(users)
    .where(and(isNotNull(users.deletedAt), lt(users.deletedAt, cutoff)));

  let deleted = 0;

  for (const user of expiredUsers) {
    await permanentlyDeleteUser(user.id, user.clerkId);
    deleted++;
  }

  return { deleted, total: expiredUsers.length };
}

/** Dev-only: immediately and permanently delete a user, skipping grace period. */
export async function immediateDeleteUser(clerkId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId));

  if (!user) throw new Error("User not found");

  await permanentlyDeleteUser(user.id, user.clerkId);
  return { ok: true };
}

async function permanentlyDeleteUser(userId: string, clerkId: string) {
  // Soft-delete personal orgs
  const personalOrgIds = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgs.id, orgMembers.orgId))
    .where(and(eq(orgMembers.userId, userId), eq(orgs.isPersonal, true)));

  for (const { orgId } of personalOrgIds) {
    await db
      .update(orgs)
      .set({ deletedAt: new Date() })
      .where(eq(orgs.id, orgId));
  }

  // Hard-delete user row (cascades to orgMembers, agentMembers)
  await db.delete(users).where(eq(users.id, userId));

  // Delete Clerk account
  try {
    await clerk.users.deleteUser(clerkId);
  } catch {
    // Clerk account may already be deleted; ignore
  }
}
