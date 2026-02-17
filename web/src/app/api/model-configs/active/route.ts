import { NextResponse } from "next/server";
import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const [active] = await db
    .select()
    .from(modelConfigs)
    .where(eq(modelConfigs.isActive, true))
    .limit(1);

  if (!active) {
    return NextResponse.json(null);
  }

  return NextResponse.json(active);
}
