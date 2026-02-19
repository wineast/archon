import { NextResponse } from "next/server";
import { db } from "@/db";
import { embedTokens, agents } from "@/db/schema";
import type { AgentRow } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export interface EmbedAuthContext {
  agent: AgentRow;
  tokenId: string;
}

/**
 * Authenticate an embed request using Bearer token.
 * Validates the token, checks origin, updates lastUsedAt.
 * Returns EmbedAuthContext on success, or NextResponse (401/403) on failure.
 */
export async function requireEmbedToken(
  req: Request
): Promise<EmbedAuthContext | NextResponse> {
  // Extract Bearer token
  const authHeader = req.headers.get("authorization");
  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 }
    );
  }

  // Look up token
  const [row] = await db
    .select()
    .from(embedTokens)
    .where(and(eq(embedTokens.token, token), eq(embedTokens.isActive, true)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Check allowed origins
  const origin = req.headers.get("origin");
  if (row.allowedOrigins.length > 0 && origin) {
    const allowed = row.allowedOrigins.some(
      (o) => o === "*" || o === origin
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Origin not allowed" },
        { status: 403 }
      );
    }
  }

  // Load agent
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, row.agentId), isNull(agents.deletedAt)))
    .limit(1);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Update lastUsedAt (fire-and-forget)
  db.update(embedTokens)
    .set({ lastUsedAt: sql`now()` })
    .where(eq(embedTokens.id, row.id))
    .then(() => {})
    .catch(() => {});

  return { agent, tokenId: row.id };
}
