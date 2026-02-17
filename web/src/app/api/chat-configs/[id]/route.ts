import { NextResponse } from "next/server";
import { db } from "@/db";
import { chatConfigs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const [existing] = await db
    .select()
    .from(chatConfigs)
    .where(eq(chatConfigs.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(chatConfigs)
    .set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.welcomeTitle !== undefined && { welcomeTitle: body.welcomeTitle }),
      ...(body.welcomeIcon !== undefined && { welcomeIcon: body.welcomeIcon }),
      ...(body.quickActions !== undefined && { quickActions: body.quickActions }),
      ...(body.placeholder !== undefined && { placeholder: body.placeholder }),
      ...(body.suggestions !== undefined && { suggestions: body.suggestions }),
    })
    .where(eq(chatConfigs.id, id))
    .returning();

  return NextResponse.json(updated);
}
