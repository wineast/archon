import { db } from "@/db";
import { agents } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { toSlug, ensureUniqueSlug } from "@/lib/agents/slug";

export async function GET() {
  const rows = await db
    .select()
    .from(agents)
    .orderBy(desc(agents.updatedAt));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, description, icon } = body as {
    name: string;
    description?: string;
    icon?: string;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const baseSlug = body.slug?.trim() || toSlug(name);
  const slug = await ensureUniqueSlug(baseSlug);

  const [agent] = await db
    .insert(agents)
    .values({
      name: name.trim(),
      description: description?.trim() ?? "",
      icon: icon ?? "bot",
      slug,
    })
    .returning();

  return NextResponse.json(agent, { status: 201 });
}
