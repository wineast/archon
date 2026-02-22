import { NextResponse } from "next/server";
import { db } from "@/db";
import { ragConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(ragConfigs)
    .where(eq(ragConfigs.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();

  const [updated] = await db
    .update(ragConfigs)
    .set({
      ...(body.embeddingModel !== undefined && { embeddingModel: body.embeddingModel }),
      ...(body.chunkSize !== undefined && { chunkSize: body.chunkSize }),
      ...(body.chunkOverlap !== undefined && { chunkOverlap: body.chunkOverlap }),
      ...(body.topK !== undefined && { topK: body.topK }),
    })
    .where(eq(ragConfigs.id, id))
    .returning();

  return NextResponse.json(updated);
}
