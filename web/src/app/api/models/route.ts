import { db } from "@/db";
import { models } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const rows = await db
    .select()
    .from(models)
    .where(eq(models.isActive, true))
    .orderBy(models.provider, models.name);
  return NextResponse.json(rows);
}
