import { db } from "@/db";
import { orgs, orgMembers } from "@/db/schema";
import type { User } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { ensureOrgDefaults } from "@/lib/slots";

/**
 * Ensure the user has a personal organization.
 * If not found, creates one and makes the user its owner.
 * Returns the org id.
 */
export async function ensurePersonalOrg(user: User): Promise<string> {
  // Look for existing personal org
  const [existing] = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgs.id, orgMembers.orgId))
    .where(and(eq(orgMembers.userId, user.id), eq(orgs.isPersonal, true)))
    .limit(1);

  if (existing) {
    await ensureOrgDefaults(existing.orgId);
    return existing.orgId;
  }

  // Create personal org
  const slug = user.id.slice(0, 8);
  const name =
    user.nickname || user.email.split("@")[0] || "个人空间";

  const [org] = await db
    .insert(orgs)
    .values({ name, slug, isPersonal: true })
    .onConflictDoUpdate({
      target: orgs.slug,
      targetWhere: isNull(orgs.deletedAt),
      set: { name },
    })
    .returning();

  await db.insert(orgMembers).values({
    orgId: org.id,
    userId: user.id,
    role: "owner",
  });

  await ensureOrgDefaults(org.id);

  return org.id;
}
