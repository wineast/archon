import { NextResponse } from "next/server";
import { db } from "@/db";
import { embedTokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; tokenId: string }> }
) {
  const { id: agentId, tokenId } = await params;
  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
  if (Array.isArray(body.allowedOrigins)) {
    updates.allowedOrigins = body.allowedOrigins.filter(
      (o: unknown) => typeof o === "string" && o
    );
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const [row] = await db
    .update(embedTokens)
    .set(updates)
    .where(
      and(eq(embedTokens.id, tokenId), eq(embedTokens.agentId, agentId))
    )
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; tokenId: string }> }
) {
  const { id: agentId, tokenId } = await params;
  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const [row] = await db
    .delete(embedTokens)
    .where(
      and(eq(embedTokens.id, tokenId), eq(embedTokens.agentId, agentId))
    )
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
