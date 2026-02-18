import { db } from "@/db";
import { functionTestRuns } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

/** GET: list runs for a function (newest first) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const runs = await db
    .select()
    .from(functionTestRuns)
    .where(eq(functionTestRuns.functionId, id))
    .orderBy(desc(functionTestRuns.createdAt));

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
    .insert(functionTestRuns)
    .values({
      functionId: id,
      filterTags: filterTags ?? [],
      totalCases,
      passedCases: 0,
    })
    .returning();

  return Response.json({ runId: run.id });
}
