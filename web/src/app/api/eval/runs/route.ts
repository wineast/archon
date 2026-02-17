import { db } from "@/db";
import { evalRuns } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const runs = await db
    .select()
    .from(evalRuns)
    .orderBy(desc(evalRuns.createdAt));

  return Response.json(runs);
}
