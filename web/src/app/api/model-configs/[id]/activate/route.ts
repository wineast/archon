import { NextResponse } from "next/server";
import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [target] = await db
    .select()
    .from(modelConfigs)
    .where(eq(modelConfigs.id, id));

  if (!target) {
    return NextResponse.json(
      { error: "Model config not found" },
      { status: 404 }
    );
  }

  // Deactivate all, then activate target (no DB-level transaction needed for Neon HTTP)
  await db
    .update(modelConfigs)
    .set({ isActive: false })
    .where(eq(modelConfigs.isActive, true));

  const [activated] = await db
    .update(modelConfigs)
    .set({ isActive: true })
    .where(eq(modelConfigs.id, id))
    .returning();

  return NextResponse.json(activated);
}
