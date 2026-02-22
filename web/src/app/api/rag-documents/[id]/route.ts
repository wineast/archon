import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { db } from "@/db";
import { ragDocuments, ragChunks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [doc] = await db
    .select()
    .from(ragDocuments)
    .where(eq(ragDocuments.id, id));

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(doc.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  // Delete chunks first (cascade should handle this, but be explicit)
  await db.delete(ragChunks).where(eq(ragChunks.documentId, id));

  // Delete the document record
  await db.delete(ragDocuments).where(eq(ragDocuments.id, id));

  // Delete from Vercel Blob (best-effort)
  try {
    await del(doc.url);
  } catch {
    // Non-critical — blob cleanup failure is acceptable
  }

  return NextResponse.json({ ok: true });
}
