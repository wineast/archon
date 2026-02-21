import { db } from "@/db";
import {
  tools, functions, components, schemas, schemaIncludes, datasets,
  wikiDocuments, modelConfigs, evalCases, evalJudgeConfigs,
  objectTypes, objectRelations, skills,
} from "@/db/schema";
import { eq, and, isNotNull, isNull, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

type ResourceType =
  | "tool" | "function" | "component" | "schema"
  | "dataset" | "wikiDocument" | "modelConfig" | "evalCase"
  | "evalJudgeConfig" | "objectType" | "objectRelation" | "skill";

const tableMap = {
  tool: tools,
  function: functions,
  component: components,
  schema: schemas,
  dataset: datasets,
  wikiDocument: wikiDocuments,
  modelConfig: modelConfigs,
  evalCase: evalCases,
  evalJudgeConfig: evalJudgeConfigs,
  objectType: objectTypes,
  objectRelation: objectRelations,
  skill: skills,
} as const;

function getTable(type: ResourceType) {
  return tableMap[type];
}

// GET — list all trashed resources grouped by type
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const [
    toolRows, functionRows, componentRows, schemaRows,
    datasetRows, wikiRows, modelConfigRows, evalCaseRows,
    evalJudgeConfigRows, objectTypeRows, objectRelationRows,
    skillRows,
  ] = await Promise.all([
    db.select({ id: tools.id, key: tools.key, name: tools.name, deletedAt: tools.deletedAt })
      .from(tools).where(and(eq(tools.agentId, agentId), isNotNull(tools.deletedAt))),
    db.select({ id: functions.id, key: functions.key, name: functions.name, deletedAt: functions.deletedAt })
      .from(functions).where(and(eq(functions.agentId, agentId), isNotNull(functions.deletedAt))),
    db.select({ id: components.id, key: components.key, name: components.name, deletedAt: components.deletedAt })
      .from(components).where(and(eq(components.agentId, agentId), isNotNull(components.deletedAt))),
    db.select({ id: schemas.id, key: schemas.key, name: schemas.name, deletedAt: schemas.deletedAt })
      .from(schemas).where(and(eq(schemas.agentId, agentId), isNotNull(schemas.deletedAt))),
    db.select({ id: datasets.id, key: datasets.key, name: datasets.name, deletedAt: datasets.deletedAt })
      .from(datasets).where(and(eq(datasets.agentId, agentId), isNotNull(datasets.deletedAt))),
    db.select({ id: wikiDocuments.id, key: wikiDocuments.key, name: wikiDocuments.name, deletedAt: wikiDocuments.deletedAt })
      .from(wikiDocuments).where(and(eq(wikiDocuments.agentId, agentId), isNotNull(wikiDocuments.deletedAt))),
    db.select({ id: modelConfigs.id, key: modelConfigs.key, name: modelConfigs.name, deletedAt: modelConfigs.deletedAt })
      .from(modelConfigs).where(and(eq(modelConfigs.agentId, agentId), isNotNull(modelConfigs.deletedAt))),
    db.select({ id: evalCases.id, key: evalCases.key, name: evalCases.name, deletedAt: evalCases.deletedAt })
      .from(evalCases).where(and(eq(evalCases.agentId, agentId), isNotNull(evalCases.deletedAt))),
    db.select({ id: evalJudgeConfigs.id, key: evalJudgeConfigs.key, name: evalJudgeConfigs.name, deletedAt: evalJudgeConfigs.deletedAt })
      .from(evalJudgeConfigs).where(and(eq(evalJudgeConfigs.agentId, agentId), isNotNull(evalJudgeConfigs.deletedAt))),
    db.select({ id: objectTypes.id, key: objectTypes.key, name: objectTypes.name, deletedAt: objectTypes.deletedAt })
      .from(objectTypes).where(and(eq(objectTypes.agentId, agentId), isNotNull(objectTypes.deletedAt))),
    db.select({ id: objectRelations.id, key: objectRelations.key, name: objectRelations.name, deletedAt: objectRelations.deletedAt })
      .from(objectRelations).where(and(eq(objectRelations.agentId, agentId), isNotNull(objectRelations.deletedAt))),
    db.select({ id: skills.id, key: skills.key, name: skills.name, deletedAt: skills.deletedAt })
      .from(skills).where(and(eq(skills.agentId, agentId), isNotNull(skills.deletedAt))),
  ]);

  const result: Record<string, unknown[]> = {
    tool: toolRows,
    function: functionRows,
    component: componentRows,
    schema: schemaRows,
    dataset: datasetRows,
    wikiDocument: wikiRows,
    modelConfig: modelConfigRows,
    evalCase: evalCaseRows,
    evalJudgeConfig: evalJudgeConfigRows,
    objectType: objectTypeRows,
    objectRelation: objectRelationRows,
    skill: skillRows,
  };

  const totalCount = Object.values(result).reduce((sum, arr) => sum + arr.length, 0);

  return NextResponse.json({ ...result, totalCount });
}

// POST — restore resources
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const { type, ids } = (await req.json()) as { type: ResourceType; ids: string[] };

  if (!type || !ids?.length) {
    return NextResponse.json({ error: "type and ids required" }, { status: 400 });
  }

  const table = getTable(type);
  if (!table) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  await db
    .update(table)
    .set({ deletedAt: null })
    .where(and(inArray(table.id, ids), isNotNull(table.deletedAt)));

  // Cascade restore: objectType → restore related objectRelations
  if (type === "objectType") {
    await db
      .update(objectRelations)
      .set({ deletedAt: null })
      .where(
        and(
          or(
            inArray(objectRelations.sourceTypeId, ids),
            inArray(objectRelations.targetTypeId, ids)
          ),
          isNotNull(objectRelations.deletedAt)
        )
      );
  }

  return NextResponse.json({ ok: true });
}

// DELETE — permanently delete resources
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  const ctx = await requireAgentRole(agentId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const { type, ids } = (await req.json()) as { type: ResourceType; ids: string[] };

  if (!type || !ids?.length) {
    return NextResponse.json({ error: "type and ids required" }, { status: 400 });
  }

  const table = getTable(type);
  if (!table) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  // For schemas: clean up schemaIncludes junction references before deleting
  if (type === "schema") {
    await db
      .delete(schemaIncludes)
      .where(
        or(
          inArray(schemaIncludes.schemaId, ids),
          inArray(schemaIncludes.includeSchemaId, ids)
        )
      );
  }

  await db
    .delete(table)
    .where(and(inArray(table.id, ids), isNotNull(table.deletedAt)));

  return NextResponse.json({ ok: true });
}
