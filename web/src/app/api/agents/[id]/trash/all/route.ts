import { db } from "@/db";
import {
  tools, functions, components, schemas, datasets,
  wikiDocuments, modelConfigs, evalCases, judgeConfigs,
  objectTypes, objectRelations, skills,
} from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

// DELETE — clear all trashed resources
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  const ctx = await requireAgentRole(agentId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  // Delete objectRelations first (FK → objectTypes)
  await db.delete(objectRelations).where(and(eq(objectRelations.agentId, agentId), isNotNull(objectRelations.deletedAt)));

  // Delete rest in parallel
  await Promise.all([
    db.delete(tools).where(and(eq(tools.agentId, agentId), isNotNull(tools.deletedAt))),
    db.delete(functions).where(and(eq(functions.agentId, agentId), isNotNull(functions.deletedAt))),
    db.delete(components).where(and(eq(components.agentId, agentId), isNotNull(components.deletedAt))),
    db.delete(schemas).where(and(eq(schemas.agentId, agentId), isNotNull(schemas.deletedAt))),
    db.delete(datasets).where(and(eq(datasets.agentId, agentId), isNotNull(datasets.deletedAt))),
    db.delete(wikiDocuments).where(and(eq(wikiDocuments.agentId, agentId), isNotNull(wikiDocuments.deletedAt))),
    db.delete(modelConfigs).where(and(eq(modelConfigs.agentId, agentId), isNotNull(modelConfigs.deletedAt))),
    db.delete(evalCases).where(and(eq(evalCases.agentId, agentId), isNotNull(evalCases.deletedAt))),
    db.delete(judgeConfigs).where(and(eq(judgeConfigs.agentId, agentId), isNotNull(judgeConfigs.deletedAt))),
    db.delete(objectTypes).where(and(eq(objectTypes.agentId, agentId), isNotNull(objectTypes.deletedAt))),
    db.delete(skills).where(and(eq(skills.agentId, agentId), isNotNull(skills.deletedAt))),
  ]);

  return NextResponse.json({ ok: true });
}
