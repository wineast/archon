import { NextResponse } from "next/server";
import { db } from "@/db";
import { objectTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { generateCrudToolsForType } from "@/lib/ontology/generate-tools";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [existing] = await db
    .select()
    .from(objectTypes)
    .where(eq(objectTypes.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Object type not found" }, { status: 404 });
  }

  const ctx = await requireAgentRole(existing.agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  try {
    const result = await generateCrudToolsForType(id, existing.agentId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate tools" },
      { status: 400 }
    );
  }
}
