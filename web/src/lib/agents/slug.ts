import { db } from "@/db";
import { agents } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";

/**
 * Convert a name to a URL-friendly slug.
 * - ASCII text: lowercase + hyphens
 * - Non-ASCII (e.g. Chinese): generate nanoid(8)
 */
export function toSlug(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (ascii.length >= 2) return ascii;

  // Fallback for non-ASCII names: random 8-char id
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Ensure the slug is unique within the given org.
 * If conflict, append -2, -3, etc.
 */
export async function ensureUniqueSlug(
  base: string,
  orgId: string,
  excludeId?: string
): Promise<string> {
  let candidate = base;
  let suffix = 2;

  while (true) {
    const conditions = [eq(agents.slug, candidate), eq(agents.orgId, orgId)];
    if (excludeId) {
      conditions.push(ne(agents.id, excludeId));
    }
    const [existing] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(...conditions))
      .limit(1);

    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
    suffix++;
  }
}
