import { db } from "@/db";
import { schemaTestRuns } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

/** GET: list runs for a schema (newest first) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const runs = await db
    .select()
    .from(schemaTestRuns)
    .where(eq(schemaTestRuns.schemaId, id))
    .orderBy(desc(schemaTestRuns.createdAt));

  return Response.json(runs);
}

/** POST: create a new run record (stats filled later by PATCH) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { filterTags, totalCases } = (await req.json()) as {
    filterTags?: string[];
    totalCases: number;
  };

  const [run] = await db
    .insert(schemaTestRuns)
    .values({
      schemaId: id,
      filterTags: filterTags ?? [],
      totalCases,
      passedCases: 0,
    })
    .returning();

  return Response.json({ runId: run.id });
}
