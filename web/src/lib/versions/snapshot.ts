import { db } from "@/db";
import {
  agents,
  tools,
  functions,
  components,
  schemas,
  wikiDocuments,
  datasets,
  modelConfigs,
  chatConfigs,
  evalCases,
  evalJudgeConfigs,
  toolTestCases,
  functionTestCases,
  componentTestCases,
  objectTypes,
  objectRelations,
  mcpServers,
  skills,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";
import type {
  AgentSnapshot,
  ToolSnapshotItem,
  FunctionSnapshotItem,
  ComponentSnapshotItem,
  SchemaSnapshotItem,
  WikiDocumentSnapshotItem,
  DatasetSnapshotItem,
  ModelConfigSnapshotItem,
  ChatConfigSnapshotItem,
  EvalCaseSnapshotItem,
  EvalJudgeConfigSnapshotItem,
  ToolTestCaseSnapshotItem,
  FunctionTestCaseSnapshotItem,
  ComponentTestCaseSnapshotItem,
  ObjectTypeSnapshotItem,
  ObjectRelationSnapshotItem,
  McpServerSnapshotItem,
  SkillSnapshotItem,
} from "./types";
import type { JsonSchema7 } from "@/lib/schemas/types";

type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/**
 * Previously used to remap x-enumDatasetId UUIDs in schema snapshots.
 * Now that x-enumDatasetId has been replaced by template strings (e.g. "{{dataset_key}}"),
 * no remapping is needed — schemas use human-readable keys directly.
 *
 * @deprecated Kept for API compatibility; returns the schema unchanged.
 */
export function remapParameterRefs(
  schema: JsonSchema7,
  _datasetMap?: Map<string, string>
): JsonSchema7 {
  return schema;
}

/* ═══════════════════════════════════════════════
   Build Snapshot
   ═══════════════════════════════════════════════ */

export async function buildSnapshot(agentId: string, externalDb?: typeof db): Promise<AgentSnapshot> {
  const _db = externalDb ?? db;
  const [
    [agent],
    toolRows,
    functionRows,
    componentRows,
    schemaRows,
    wikiRows,
    datasetRows,
    modelConfigRows,
    chatConfigRows,
    evalCaseRows,
    evalJudgeConfigRows,
    toolTestCaseRows,
    functionTestCaseRows,
    componentTestCaseRows,
    objectTypeRows,
    objectRelationRows,
    mcpServerRows,
    skillRows,
  ] = await Promise.all([
    _db.select().from(agents).where(eq(agents.id, agentId)).limit(1),
    _db.select().from(tools).where(and(eq(tools.agentId, agentId), isNull(tools.deletedAt))),
    _db.select().from(functions).where(and(eq(functions.agentId, agentId), isNull(functions.deletedAt))),
    _db.select().from(components).where(and(eq(components.agentId, agentId), isNull(components.deletedAt))),
    _db.select().from(schemas).where(and(eq(schemas.agentId, agentId), isNull(schemas.deletedAt))),
    _db.select().from(wikiDocuments).where(and(eq(wikiDocuments.agentId, agentId), isNull(wikiDocuments.deletedAt))),
    _db.select().from(datasets).where(and(eq(datasets.agentId, agentId), isNull(datasets.deletedAt))),
    _db.select().from(modelConfigs).where(and(eq(modelConfigs.agentId, agentId), isNull(modelConfigs.deletedAt))),
    _db.select().from(chatConfigs).where(eq(chatConfigs.agentId, agentId)),
    _db.select().from(evalCases).where(and(eq(evalCases.agentId, agentId), isNull(evalCases.deletedAt))),
    _db
      .select()
      .from(evalJudgeConfigs)
      .where(and(eq(evalJudgeConfigs.agentId, agentId), isNull(evalJudgeConfigs.deletedAt))),
    // Test cases: join through parent tables (only non-deleted parents)
    _db
      .select()
      .from(toolTestCases)
      .innerJoin(tools, eq(toolTestCases.toolId, tools.id))
      .where(and(eq(tools.agentId, agentId), isNull(tools.deletedAt))),
    _db
      .select()
      .from(functionTestCases)
      .innerJoin(functions, eq(functionTestCases.functionId, functions.id))
      .where(and(eq(functions.agentId, agentId), isNull(functions.deletedAt))),
    _db
      .select()
      .from(componentTestCases)
      .innerJoin(
        components,
        eq(componentTestCases.componentId, components.id)
      )
      .where(and(eq(components.agentId, agentId), isNull(components.deletedAt))),
    _db.select().from(objectTypes).where(and(eq(objectTypes.agentId, agentId), isNull(objectTypes.deletedAt))),
    _db.select().from(objectRelations).where(and(eq(objectRelations.agentId, agentId), isNull(objectRelations.deletedAt))),
    _db.select().from(mcpServers).where(and(eq(mcpServers.agentId, agentId), isNull(mcpServers.deletedAt))),
    _db.select().from(skills).where(and(eq(skills.agentId, agentId), isNull(skills.deletedAt))),
  ]);

  if (!agent) throw new Error("Agent not found");

  // Build tool id → key map
  const toolIdToKey = new Map(toolRows.map((t) => [t.id, t.key]));
  const funcIdToKey = new Map(functionRows.map((f) => [f.id, f.key]));
  const compIdToKey = new Map(componentRows.map((c) => [c.id, c.key]));

  // Group test cases by parent key
  const toolTestsByKey = new Map<string, ToolTestCaseSnapshotItem[]>();
  for (const row of toolTestCaseRows) {
    const key = toolIdToKey.get(row.tools.id)!;
    const items = toolTestsByKey.get(key) ?? [];
    items.push({
      name: row.tool_test_cases.name,
      input: row.tool_test_cases.input,
      expectedOutput: row.tool_test_cases.expectedOutput,
      tags: row.tool_test_cases.tags,
    });
    toolTestsByKey.set(key, items);
  }

  const funcTestsByKey = new Map<string, FunctionTestCaseSnapshotItem[]>();
  for (const row of functionTestCaseRows) {
    const key = funcIdToKey.get(row.functions.id)!;
    const items = funcTestsByKey.get(key) ?? [];
    items.push({
      name: row.function_test_cases.name,
      input: row.function_test_cases.input,
      expectedOutput: row.function_test_cases.expectedOutput,
      tags: row.function_test_cases.tags,
    });
    funcTestsByKey.set(key, items);
  }

  const compTestsByKey = new Map<string, ComponentTestCaseSnapshotItem[]>();
  for (const row of componentTestCaseRows) {
    const key = compIdToKey.get(row.components.id)!;
    const items = compTestsByKey.get(key) ?? [];
    items.push({
      name: row.component_test_cases.name,
      data: row.component_test_cases.data,
      tags: row.component_test_cases.tags,
    });
    compTestsByKey.set(key, items);
  }

  // Wiki: convert parentId to parentKey
  const wikiIdToKey = new Map(wikiRows.map((w) => [w.id, w.key]));

  // Schema: convert id to key for snapshot references
  const schemaIdToKey = new Map(schemaRows.map((s) => [s.id, s.key]));

  // Dataset: convert id to key for parameter refs
  const datasetIdToKey = new Map(datasetRows.map((d) => [d.id, d.key]));

  // ObjectType: convert id to key for relation snapshot references
  const objTypeIdToKey = new Map(objectTypeRows.map((t) => [t.id, t.key]));

  return {
    agent: {
      name: agent.name,
      description: agent.description,
      icon: agent.icon,
      slug: agent.slug,
      isPublic: agent.isPublic,
    },
    tools: toolRows.map(
      (t): ToolSnapshotItem => ({
        key: t.key,
        name: t.name,
        description: t.description,
        parametersSchema: t.parametersSchema ?? null,
        returnParametersSchema: t.returnParametersSchema ?? null,
        handler: t.handler,
        url: t.url,
        componentKey: t.componentId ? compIdToKey.get(t.componentId) ?? null : null,
        enabled: t.enabled,
        executionTarget: t.executionTarget,
        testCases: toolTestsByKey.get(t.key) ?? [],
      })
    ),
    functions: functionRows.map(
      (f): FunctionSnapshotItem => ({
        key: f.key,
        name: f.name,
        description: f.description,
        code: f.code,
        parametersSchema: f.parametersSchema ?? null,
        returnParametersSchema: f.returnParametersSchema ?? null,
        testCases: funcTestsByKey.get(f.key) ?? [],
      })
    ),
    components: componentRows.map(
      (c): ComponentSnapshotItem => ({
        key: c.key,
        name: c.name,
        description: c.description,
        componentSource: c.componentSource,
        generatedCss: c.generatedCss,
        inputSchema: c.inputSchema ?? null,
        outputSchema: c.outputSchema ?? null,
        testCases: compTestsByKey.get(c.key) ?? [],
      })
    ),
    schemas: schemaRows.map(
      (s): SchemaSnapshotItem => ({
        key: s.key,
        name: s.name,
        description: s.description,
        parameters: remapParameterRefs(s.parameters, datasetIdToKey),
      })
    ),
    wikiDocuments: wikiRows.map(
      (w): WikiDocumentSnapshotItem => ({
        key: w.key,
        name: w.name,
        content: w.content,
        order: w.order,
        parentKey: w.parentId ? (wikiIdToKey.get(w.parentId) ?? null) : null,
      })
    ),
    datasets: datasetRows.map(
      (d): DatasetSnapshotItem => ({
        key: d.key,
        name: d.name,
        description: d.description,
        data: d.data,
      })
    ),
    modelConfigs: modelConfigRows.map(
      (m): ModelConfigSnapshotItem => ({
        key: m.key,
        name: m.name,
        modelId: m.modelId,
        systemPrompt: m.systemPrompt,
        temperature: m.temperature,
        isActive: m.isActive,
      })
    ),
    chatConfig: chatConfigRows[0]
      ? ({
          title: chatConfigRows[0].title,
          welcomeTitle: chatConfigRows[0].welcomeTitle,
          welcomeIcon: chatConfigRows[0].welcomeIcon,
          quickActions: chatConfigRows[0].quickActions,
          placeholder: chatConfigRows[0].placeholder,
          suggestions: chatConfigRows[0].suggestions,
        } satisfies ChatConfigSnapshotItem)
      : null,
    evalCases: evalCaseRows.map(
      (e): EvalCaseSnapshotItem => ({
        key: e.key,
        name: e.name,
        mode: e.mode,
        turns: e.turns,
        expectedOutput: e.expectedOutput,
        assertions: e.assertions,
        tags: e.tags,
      })
    ),
    evalJudgeConfigs: evalJudgeConfigRows.map(
      (j): EvalJudgeConfigSnapshotItem => ({
        key: j.key,
        name: j.name,
        model: j.model,
        systemPrompt: j.systemPrompt,
        temperature: j.temperature,
        dimensions: j.dimensions,
        isDefault: j.isDefault,
      })
    ),
    objectTypes: objectTypeRows.map(
      (t): ObjectTypeSnapshotItem => ({
        key: t.key,
        name: t.name,
        description: t.description,
        icon: t.icon,
        color: t.color,
        schemaKey: t.schemaId ? schemaIdToKey.get(t.schemaId) ?? null : null,
        titleProperty: t.titleProperty,
        source: t.source,
        externalConfig: t.externalConfig ?? null,
        order: t.order,
      })
    ),
    objectRelations: objectRelationRows.map(
      (r): ObjectRelationSnapshotItem => ({
        key: r.key,
        name: r.name,
        description: r.description,
        sourceTypeKey: objTypeIdToKey.get(r.sourceTypeId) ?? "",
        targetTypeKey: objTypeIdToKey.get(r.targetTypeId) ?? "",
        relationType: r.relationType,
        inverseName: r.inverseName,
        order: r.order,
      })
    ),
    mcpServers: mcpServerRows.map(
      (s): McpServerSnapshotItem => ({
        key: s.key,
        name: s.name,
        description: s.description,
        url: s.url,
        transportType: s.transportType,
        headers: s.headers,
        enabled: s.enabled,
      })
    ),
    skills: skillRows.map(
      (s): SkillSnapshotItem => ({
        key: s.key,
        name: s.name,
        description: s.description,
        content: s.content,
        enabled: s.enabled,
        order: s.order,
      })
    ),
  };
}

/* ═══════════════════════════════════════════════
   Restore Snapshot
   ═══════════════════════════════════════════════ */

export async function restoreSnapshot(
  agentId: string,
  snapshot: AgentSnapshot,
  tx: Tx
) {
  // 1. Delete all existing config data (CASCADE takes care of test cases & test runs)
  // Delete objectRelations first (FK → objectTypes), then objectTypes
  await tx.delete(objectRelations).where(eq(objectRelations.agentId, agentId));
  await Promise.all([
    tx.delete(objectTypes).where(eq(objectTypes.agentId, agentId)),
    tx.delete(tools).where(eq(tools.agentId, agentId)),
    tx.delete(functions).where(eq(functions.agentId, agentId)),
    tx.delete(components).where(eq(components.agentId, agentId)),
    tx.delete(schemas).where(eq(schemas.agentId, agentId)),
    tx.delete(wikiDocuments).where(eq(wikiDocuments.agentId, agentId)),
    tx.delete(datasets).where(eq(datasets.agentId, agentId)),
    tx.delete(modelConfigs).where(eq(modelConfigs.agentId, agentId)),
    tx.delete(chatConfigs).where(eq(chatConfigs.agentId, agentId)),
    tx.delete(evalCases).where(eq(evalCases.agentId, agentId)),
    tx.delete(evalJudgeConfigs).where(eq(evalJudgeConfigs.agentId, agentId)),
    tx.delete(mcpServers).where(eq(mcpServers.agentId, agentId)),
    tx.delete(skills).where(eq(skills.agentId, agentId)),
  ]);

  // 2a. Rebuild datasets first (schemas may reference them via enumDatasetId in parameters)
  const datasetKeyToNewId = new Map<string, string>();
  if (snapshot.datasets.length > 0) {
    const insertedDatasets = await tx
      .insert(datasets)
      .values(
        snapshot.datasets.map((d) => ({
          agentId,
          key: d.key,
          name: d.name,
          description: d.description,
          data: d.data,
        }))
      )
      .returning({ id: datasets.id, key: datasets.key });
    for (const d of insertedDatasets) {
      datasetKeyToNewId.set(d.key, d.id);
    }
  }

  // 2b. Rebuild schemas (tools/components reference them via FK)
  const schemaKeyToNewId = new Map<string, string>();
  if (snapshot.schemas.length > 0) {
    // Insert schemas (parameters still contain dataset key references)
    const insertedSchemas = await tx
      .insert(schemas)
      .values(
        snapshot.schemas.map((s) => ({
          agentId,
          key: s.key,
          name: s.name,
          description: s.description,
          parameters: s.parameters,
        }))
      )
      .returning({ id: schemas.id, key: schemas.key });
    for (const s of insertedSchemas) {
      schemaKeyToNewId.set(s.key, s.id);
    }

    // Remap dataset key→newUUID in parameters and update each schema
    for (const s of snapshot.schemas) {
      const schemaId = schemaKeyToNewId.get(s.key);
      if (!schemaId) continue;
      const remapped = remapParameterRefs(s.parameters, datasetKeyToNewId);
      await tx
        .update(schemas)
        .set({ parameters: remapped })
        .where(eq(schemas.id, schemaId));
    }
  }

  // 2b. Rebuild objectTypes (after schemas, since they reference schemas via FK)
  const objTypeKeyToNewId = new Map<string, string>();
  if (snapshot.objectTypes?.length) {
    const insertedObjTypes = await tx
      .insert(objectTypes)
      .values(
        snapshot.objectTypes.map((t) => ({
          agentId,
          key: t.key,
          name: t.name,
          description: t.description,
          icon: t.icon,
          color: t.color,
          schemaId: t.schemaKey ? schemaKeyToNewId.get(t.schemaKey) ?? null : null,
          titleProperty: t.titleProperty ?? null,
          source: t.source ?? "internal",
          externalConfig: t.externalConfig ?? null,
          order: t.order,
        }))
      )
      .returning({ id: objectTypes.id, key: objectTypes.key });
    for (const t of insertedObjTypes) {
      objTypeKeyToNewId.set(t.key, t.id);
    }
  }

  // 2c. Rebuild objectRelations (after objectTypes)
  if (snapshot.objectRelations?.length) {
    await tx.insert(objectRelations).values(
      snapshot.objectRelations.map((r) => ({
        agentId,
        key: r.key,
        name: r.name,
        description: r.description,
        sourceTypeId: objTypeKeyToNewId.get(r.sourceTypeKey)!,
        targetTypeId: objTypeKeyToNewId.get(r.targetTypeKey)!,
        relationType: r.relationType,
        inverseName: r.inverseName,
        order: r.order,
      }))
    );
  }

  // 3. Rebuild components + test cases (before tools, since tools reference components via FK)
  const compKeyToNewId = new Map<string, string>();
  if (snapshot.components.length > 0) {
    const insertedComponents = await tx
      .insert(components)
      .values(
        snapshot.components.map((c) => ({
          agentId,
          key: c.key,
          name: c.name,
          description: c.description,
          componentSource: c.componentSource,
          generatedCss: c.generatedCss,
          inputSchema: c.inputSchema ?? null,
          outputSchema: c.outputSchema ?? null,
        }))
      )
      .returning({ id: components.id, key: components.key });

    for (const c of insertedComponents) {
      compKeyToNewId.set(c.key, c.id);
    }

    const compTCs = snapshot.components.flatMap((c) =>
      c.testCases.map((tc) => ({
        componentId: compKeyToNewId.get(c.key)!,
        name: tc.name,
        data: tc.data,
        tags: tc.tags,
      }))
    );
    if (compTCs.length > 0) {
      await tx.insert(componentTestCases).values(compTCs);
    }
  }

  // 4. Rebuild tools + test cases
  if (snapshot.tools.length > 0) {
    const insertedTools = await tx
      .insert(tools)
      .values(
        snapshot.tools.map((t) => ({
          agentId,
          key: t.key,
          name: t.name,
          description: t.description,
          parametersSchema: t.parametersSchema ?? null,
          returnParametersSchema: t.returnParametersSchema ?? null,
          handler: t.handler,
          url: t.url ?? null,
          componentId: t.componentKey ? compKeyToNewId.get(t.componentKey) ?? null : null,
          enabled: t.enabled,
          executionTarget: t.executionTarget,
        }))
      )
      .returning({ id: tools.id, key: tools.key });

    const toolKeyToNewId = new Map(insertedTools.map((t) => [t.key, t.id]));
    const toolTCs = snapshot.tools.flatMap((t) =>
      t.testCases.map((tc) => ({
        toolId: toolKeyToNewId.get(t.key)!,
        name: tc.name,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        tags: tc.tags,
      }))
    );
    if (toolTCs.length > 0) {
      await tx.insert(toolTestCases).values(toolTCs);
    }
  }

  // 5. Rebuild functions + test cases
  if (snapshot.functions.length > 0) {
    const insertedFunctions = await tx
      .insert(functions)
      .values(
        snapshot.functions.map((f) => ({
          agentId,
          key: f.key,
          name: f.name,
          description: f.description,
          code: f.code,
          parametersSchema: f.parametersSchema ?? null,
          returnParametersSchema: f.returnParametersSchema ?? null,
        }))
      )
      .returning({ id: functions.id, key: functions.key });

    const funcKeyToNewId = new Map(
      insertedFunctions.map((f) => [f.key, f.id])
    );
    const funcTCs = snapshot.functions.flatMap((f) =>
      f.testCases.map((tc) => ({
        functionId: funcKeyToNewId.get(f.key)!,
        name: tc.name,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        tags: tc.tags,
      }))
    );
    if (funcTCs.length > 0) {
      await tx.insert(functionTestCases).values(funcTCs);
    }
  }

  // 6. Rebuild wiki documents (two-pass for parentKey)
  if (snapshot.wikiDocuments.length > 0) {
    // First pass: insert all with parentId = null
    const wikiValues = snapshot.wikiDocuments.map((w) => ({
      agentId,
      key: w.key,
      name: w.name,
      content: w.content,
      order: w.order,
      parentId: null as string | null,
    }));

    const insertedWiki = await tx
      .insert(wikiDocuments)
      .values(wikiValues)
      .returning({ id: wikiDocuments.id, key: wikiDocuments.key });

    // Second pass: update parentId for documents with parentKey
    const wikiKeyToNewId = new Map(insertedWiki.map((w) => [w.key, w.id]));
    for (const doc of snapshot.wikiDocuments) {
      if (doc.parentKey) {
        const newId = wikiKeyToNewId.get(doc.key);
        const parentNewId = wikiKeyToNewId.get(doc.parentKey);
        if (newId && parentNewId) {
          await tx
            .update(wikiDocuments)
            .set({ parentId: parentNewId })
            .where(eq(wikiDocuments.id, newId));
        }
      }
    }
  }

  // 7. (Datasets already rebuilt in step 2a above)

  // 8. Rebuild model configs
  if (snapshot.modelConfigs.length > 0) {
    await tx.insert(modelConfigs).values(
      snapshot.modelConfigs.map((m) => ({
        agentId,
        key: m.key,
        name: m.name,
        modelId: m.modelId,
        systemPrompt: m.systemPrompt,
        temperature: m.temperature,
        isActive: m.isActive,
      }))
    );
  }

  // 9. Rebuild chat config
  if (snapshot.chatConfig) {
    await tx.insert(chatConfigs).values({
      agentId,
      title: snapshot.chatConfig.title,
      welcomeTitle: snapshot.chatConfig.welcomeTitle,
      welcomeIcon: snapshot.chatConfig.welcomeIcon,
      quickActions: snapshot.chatConfig.quickActions,
      placeholder: snapshot.chatConfig.placeholder,
      suggestions: snapshot.chatConfig.suggestions,
    });
  }

  // 10. Rebuild eval cases
  if (snapshot.evalCases.length > 0) {
    await tx.insert(evalCases).values(
      snapshot.evalCases.map((e) => ({
        agentId,
        key: e.key,
        name: e.name,
        mode: e.mode,
        turns: e.turns,
        expectedOutput: e.expectedOutput,
        assertions: e.assertions,
        tags: e.tags,
      }))
    );
  }

  // 11. Rebuild eval judge configs
  if (snapshot.evalJudgeConfigs.length > 0) {
    await tx.insert(evalJudgeConfigs).values(
      snapshot.evalJudgeConfigs.map((j) => ({
        agentId,
        key: j.key,
        name: j.name,
        model: j.model,
        systemPrompt: j.systemPrompt,
        temperature: j.temperature,
        dimensions: j.dimensions,
        isDefault: j.isDefault,
      }))
    );
  }

  // 12. Rebuild MCP servers
  if (snapshot.mcpServers?.length) {
    await tx.insert(mcpServers).values(
      snapshot.mcpServers.map((s) => ({
        agentId,
        key: s.key,
        name: s.name,
        description: s.description,
        url: s.url,
        transportType: s.transportType,
        headers: s.headers,
        enabled: s.enabled,
      }))
    );
  }

  // 13. Rebuild skills
  if (snapshot.skills?.length) {
    await tx.insert(skills).values(
      snapshot.skills.map((s) => ({
        agentId,
        key: s.key,
        name: s.name,
        description: s.description,
        content: s.content,
        enabled: s.enabled,
        order: s.order,
      }))
    );
  }
}
