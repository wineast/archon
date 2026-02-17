import { NextResponse } from "next/server";
import { db } from "@/db";
import { chatConfigs } from "@/db/schema";

export async function GET() {
  const [row] = await db
    .select()
    .from(chatConfigs)
    .orderBy(chatConfigs.createdAt)
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "No chat config" }, { status: 404 });
  }

  return NextResponse.json(row);
}
