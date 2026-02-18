import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { wikiDocuments } from "@/db/schema";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

interface ReorderUpdate {
  id: string;
  order: number;
}

export async function POST(req: Request) {
  const body = await req.json();
  const updates: ReorderUpdate[] = body.updates;
  const agentId: string | undefined = body.agentId;

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "updates array is required" }, { status: 400 });
  }

  // Look up agentId from first doc if not provided
  let resolvedAgentId = agentId;
  if (!resolvedAgentId) {
    const [doc] = await db
      .select({ agentId: wikiDocuments.agentId })
      .from(wikiDocuments)
      .where(eq(wikiDocuments.id, updates[0].id))
      .limit(1);
    resolvedAgentId = doc?.agentId ?? undefined;
  }

  if (!resolvedAgentId) {
    return NextResponse.json({ error: "Could not determine agentId" }, { status: 400 });
  }

  const ctx = await requireAgentRole(resolvedAgentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  await Promise.all(
    updates.map((u) =>
      db.update(wikiDocuments).set({ order: u.order }).where(eq(wikiDocuments.id, u.id))
    )
  );

  return NextResponse.json({ ok: true });
}
