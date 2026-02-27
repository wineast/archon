import {
  datasets,
  schemas,
  schemaTestCases,
  objectTypes,
  objectRelations,
  components,
  componentTestCases,
  tools,
  toolTestCases,
  functions,
  functionTestCases,
  wikiDocuments,
  modelConfigs,
  chatConfigs,
  evalCases,
  judgeConfigs,
  mcpServers,
  skills,
  memoryConfigs,
  agentResourceRefs,
} from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";

type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/**
 * Copy all versioned resources from one version to another.
 *
 * Follows FK dependency order:
 *   1. datasets
 *   2. schemas (+schemaTestCases)
 *   3. objectTypes (→ schemas)
 *   4. objectRelations (→ objectTypes)
 *   5. components (+componentTestCases)
 *   6. tools (+toolTestCases, → components)
 *   7. functions (+functionTestCases)
 *   8. wikiDocuments (self-ref parentId, two passes)
 *   9. modelConfigs
 *  10. chatConfigs
 *  11. evalCases
 *  12. judgeConfigs
 *  13. mcpServers
 *  14. skills
 *  15. memoryConfigs
 *  16. agentResourceRefs (pool refs only, resourceId unchanged)
 *
 * Does NOT copy: memories (runtime), testRuns (runtime), objectInstances/objectLinks (runtime)
 */
export async function copyVersionResources(
  agentId: string,
  sourceVersionId: string,
  targetVersionId: string,
  tx: Tx
): Promise<void> {
  // ── 1. Datasets ──
  const datasetIdMap = new Map<string, string>();
  const datasetRows = await tx
    .select()
    .from(datasets)
    .where(and(eq(datasets.versionId, sourceVersionId), isNull(datasets.deletedAt)));

  if (datasetRows.length > 0) {
    const inserted = await tx
      .insert(datasets)
      .values(
        datasetRows.map((d) => ({
          agentId,
          versionId: targetVersionId,
          key: d.key,
          name: d.name,
          description: d.description,
          data: d.data,
          origin: d.origin,
        }))
      )
      .returning({ id: datasets.id, key: datasets.key });
    const keyToNewId = new Map(inserted.map((r) => [r.key, r.id]));
    for (const d of datasetRows) {
      const newId = keyToNewId.get(d.key);
      if (newId) datasetIdMap.set(d.id, newId);
    }
  }

  // ── 2. Schemas + schemaTestCases ──
  const schemaIdMap = new Map<string, string>();
  const schemaRows = await tx
    .select()
    .from(schemas)
    .where(and(eq(schemas.versionId, sourceVersionId), isNull(schemas.deletedAt)));

  if (schemaRows.length > 0) {
    const inserted = await tx
      .insert(schemas)
      .values(
        schemaRows.map((s) => ({
          agentId,
          versionId: targetVersionId,
          key: s.key,
          name: s.name,
          description: s.description,
          parameters: s.parameters,
          origin: s.origin,
        }))
      )
      .returning({ id: schemas.id, key: schemas.key });
    const keyToNewId = new Map(inserted.map((r) => [r.key, r.id]));
    for (const s of schemaRows) {
      const newId = keyToNewId.get(s.key);
      if (newId) schemaIdMap.set(s.id, newId);
    }

    // Copy schema test cases
    const oldSchemaIds = schemaRows.map((s) => s.id);
    const stcRows = await tx
      .select()
      .from(schemaTestCases)
      .where(
        oldSchemaIds.length === 1
          ? eq(schemaTestCases.schemaId, oldSchemaIds[0])
          : inArray(schemaTestCases.schemaId, oldSchemaIds)
      );
    if (stcRows.length > 0) {
      await tx.insert(schemaTestCases).values(
        stcRows
          .filter((tc) => schemaIdMap.has(tc.schemaId))
          .map((tc) => ({
            schemaId: schemaIdMap.get(tc.schemaId)!,
            name: tc.name,
            input: tc.input,
            shouldPass: tc.shouldPass,
            expectedErrors: tc.expectedErrors,
            tags: tc.tags,
            showAsExample: tc.showAsExample,
          }))
      );
    }
  }

  // ── 3. Object Types (→ schemas via schemaId) ──
  const objTypeIdMap = new Map<string, string>();
  const objTypeRows = await tx
    .select()
    .from(objectTypes)
    .where(and(eq(objectTypes.versionId, sourceVersionId), isNull(objectTypes.deletedAt)));

  if (objTypeRows.length > 0) {
    const inserted = await tx
      .insert(objectTypes)
      .values(
        objTypeRows.map((t) => ({
          agentId,
          versionId: targetVersionId,
          key: t.key,
          name: t.name,
          description: t.description,
          icon: t.icon,
          color: t.color,
          schemaId: t.schemaId ? schemaIdMap.get(t.schemaId) ?? null : null,
          titleProperty: t.titleProperty,
          source: t.source,
          externalConfig: t.externalConfig,
          order: t.order,
        }))
      )
      .returning({ id: objectTypes.id, key: objectTypes.key });
    const keyToNewId = new Map(inserted.map((r) => [r.key, r.id]));
    for (const t of objTypeRows) {
      const newId = keyToNewId.get(t.key);
      if (newId) objTypeIdMap.set(t.id, newId);
    }
  }

  // ── 4. Object Relations (→ objectTypes via sourceTypeId, targetTypeId) ──
  const objRelRows = await tx
    .select()
    .from(objectRelations)
    .where(and(eq(objectRelations.versionId, sourceVersionId), isNull(objectRelations.deletedAt)));

  const validObjRelRows = objRelRows.filter(
    (r) => objTypeIdMap.has(r.sourceTypeId) && objTypeIdMap.has(r.targetTypeId)
  );
  if (validObjRelRows.length > 0) {
    await tx.insert(objectRelations).values(
      validObjRelRows.map((r) => ({
        agentId,
        versionId: targetVersionId,
        key: r.key,
        name: r.name,
        description: r.description,
        sourceTypeId: objTypeIdMap.get(r.sourceTypeId)!,
        targetTypeId: objTypeIdMap.get(r.targetTypeId)!,
        relationType: r.relationType,
        inverseName: r.inverseName,
        order: r.order,
      }))
    );
  }

  // ── 5. Components + componentTestCases ──
  const compIdMap = new Map<string, string>();
  const compRows = await tx
    .select()
    .from(components)
    .where(and(eq(components.versionId, sourceVersionId), isNull(components.deletedAt)));

  if (compRows.length > 0) {
    const inserted = await tx
      .insert(components)
      .values(
        compRows.map((c) => ({
          agentId,
          versionId: targetVersionId,
          key: c.key,
          name: c.name,
          description: c.description,
          componentSource: c.componentSource,
          generatedCss: c.generatedCss,
          toolInputSchema: c.toolInputSchema,
          componentInputSchema: c.componentInputSchema,
          origin: c.origin,
        }))
      )
      .returning({ id: components.id, key: components.key });
    const keyToNewId = new Map(inserted.map((r) => [r.key, r.id]));
    for (const c of compRows) {
      const newId = keyToNewId.get(c.key);
      if (newId) compIdMap.set(c.id, newId);
    }

    // Copy component test cases
    const oldCompIds = compRows.map((c) => c.id);
    const ctcRows = await tx
      .select()
      .from(componentTestCases)
      .where(
        oldCompIds.length === 1
          ? eq(componentTestCases.componentId, oldCompIds[0])
          : inArray(componentTestCases.componentId, oldCompIds)
      );
    if (ctcRows.length > 0) {
      await tx.insert(componentTestCases).values(
        ctcRows
          .filter((tc) => compIdMap.has(tc.componentId))
          .map((tc) => ({
            componentId: compIdMap.get(tc.componentId)!,
            name: tc.name,
            data: tc.data,
            tags: tc.tags,
            scenario: tc.scenario,
            showAsExample: tc.showAsExample,
          }))
      );
    }
  }

  // ── 6. Tools + toolTestCases (→ components via componentId) ──
  const toolRows = await tx
    .select()
    .from(tools)
    .where(and(eq(tools.versionId, sourceVersionId), isNull(tools.deletedAt)));

  if (toolRows.length > 0) {
    const inserted = await tx
      .insert(tools)
      .values(
        toolRows.map((t) => ({
          agentId,
          versionId: targetVersionId,
          key: t.key,
          name: t.name,
          description: t.description,
          parametersSchema: t.parametersSchema,
          returnParametersSchema: t.returnParametersSchema,
          handler: t.handler,
          url: t.url,
          componentId: t.componentId ? compIdMap.get(t.componentId) ?? t.componentId : null,
          enabled: t.enabled,
          executionTarget: t.executionTarget,
          sandboxMode: t.sandboxMode,
          origin: t.origin,
        }))
      )
      .returning({ id: tools.id, key: tools.key });
    const toolIdMap = new Map<string, string>();
    const keyToNewId = new Map(inserted.map((r) => [r.key, r.id]));
    for (const t of toolRows) {
      const newId = keyToNewId.get(t.key);
      if (newId) toolIdMap.set(t.id, newId);
    }

    // Copy tool test cases
    const oldToolIds = toolRows.map((t) => t.id);
    const ttcRows = await tx
      .select()
      .from(toolTestCases)
      .where(
        oldToolIds.length === 1
          ? eq(toolTestCases.toolId, oldToolIds[0])
          : inArray(toolTestCases.toolId, oldToolIds)
      );
    if (ttcRows.length > 0) {
      await tx.insert(toolTestCases).values(
        ttcRows
          .filter((tc) => toolIdMap.has(tc.toolId))
          .map((tc) => ({
            toolId: toolIdMap.get(tc.toolId)!,
            name: tc.name,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            tags: tc.tags,
            showAsExample: tc.showAsExample,
          }))
      );
    }
  }

  // ── 7. Functions + functionTestCases ──
  const funcRows = await tx
    .select()
    .from(functions)
    .where(and(eq(functions.versionId, sourceVersionId), isNull(functions.deletedAt)));

  if (funcRows.length > 0) {
    const inserted = await tx
      .insert(functions)
      .values(
        funcRows.map((f) => ({
          agentId,
          versionId: targetVersionId,
          key: f.key,
          name: f.name,
          description: f.description,
          code: f.code,
          parametersSchema: f.parametersSchema,
          returnParametersSchema: f.returnParametersSchema,
          origin: f.origin,
        }))
      )
      .returning({ id: functions.id, key: functions.key });
    const funcIdMap = new Map<string, string>();
    const keyToNewId = new Map(inserted.map((r) => [r.key, r.id]));
    for (const f of funcRows) {
      const newId = keyToNewId.get(f.key);
      if (newId) funcIdMap.set(f.id, newId);
    }

    // Copy function test cases
    const oldFuncIds = funcRows.map((f) => f.id);
    const ftcRows = await tx
      .select()
      .from(functionTestCases)
      .where(
        oldFuncIds.length === 1
          ? eq(functionTestCases.functionId, oldFuncIds[0])
          : inArray(functionTestCases.functionId, oldFuncIds)
      );
    if (ftcRows.length > 0) {
      await tx.insert(functionTestCases).values(
        ftcRows
          .filter((tc) => funcIdMap.has(tc.functionId))
          .map((tc) => ({
            functionId: funcIdMap.get(tc.functionId)!,
            name: tc.name,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            tags: tc.tags,
            showAsExample: tc.showAsExample,
          }))
      );
    }
  }

  // ── 8. Wiki Documents (self-ref parentId, two passes) ──
  const wikiRows = await tx
    .select()
    .from(wikiDocuments)
    .where(and(eq(wikiDocuments.versionId, sourceVersionId), isNull(wikiDocuments.deletedAt)));

  if (wikiRows.length > 0) {
    // First pass: insert all with parentId = null
    const inserted = await tx
      .insert(wikiDocuments)
      .values(
        wikiRows.map((w) => ({
          agentId,
          versionId: targetVersionId,
          key: w.key,
          name: w.name,
          content: w.content,
          order: w.order,
          parentId: null as string | null,
          origin: w.origin,
        }))
      )
      .returning({ id: wikiDocuments.id, key: wikiDocuments.key });

    const wikiIdMap = new Map<string, string>();
    const keyToNewId = new Map(inserted.map((r) => [r.key, r.id]));
    for (const w of wikiRows) {
      const newId = keyToNewId.get(w.key);
      if (newId) wikiIdMap.set(w.id, newId);
    }

    // Second pass: update parentId for documents with parent
    for (const w of wikiRows) {
      if (w.parentId) {
        const newId = wikiIdMap.get(w.id);
        const newParentId = wikiIdMap.get(w.parentId);
        if (newId && newParentId) {
          await tx
            .update(wikiDocuments)
            .set({ parentId: newParentId })
            .where(eq(wikiDocuments.id, newId));
        }
      }
    }
  }

  // ── 9. Model Configs ──
  const mcRows = await tx
    .select()
    .from(modelConfigs)
    .where(and(eq(modelConfigs.versionId, sourceVersionId), isNull(modelConfigs.deletedAt)));

  if (mcRows.length > 0) {
    await tx.insert(modelConfigs).values(
      mcRows.map((m) => ({
        agentId,
        versionId: targetVersionId,
        key: m.key,
        name: m.name,
        modelId: m.modelId,
        systemPrompt: m.systemPrompt,
        temperature: m.temperature,
        isActive: m.isActive,
      }))
    );
  }

  // ── 10. Chat Configs ──
  const ccRows = await tx
    .select()
    .from(chatConfigs)
    .where(eq(chatConfigs.versionId, sourceVersionId));

  if (ccRows.length > 0) {
    await tx.insert(chatConfigs).values(
      ccRows.map((c) => ({
        agentId,
        versionId: targetVersionId,
        title: c.title,
        welcomeTitle: c.welcomeTitle,
        welcomeIcon: c.welcomeIcon,
        quickActions: c.quickActions,
        placeholder: c.placeholder,
        suggestions: c.suggestions,
        enableVoice: c.enableVoice,
        enableAttachment: c.enableAttachment,
      }))
    );
  }

  // ── 11. Eval Cases ──
  const ecRows = await tx
    .select()
    .from(evalCases)
    .where(and(eq(evalCases.versionId, sourceVersionId), isNull(evalCases.deletedAt)));

  if (ecRows.length > 0) {
    await tx.insert(evalCases).values(
      ecRows.map((e) => ({
        agentId,
        versionId: targetVersionId,
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

  // ── 12. Judge Configs ──
  const jcRows = await tx
    .select()
    .from(judgeConfigs)
    .where(and(eq(judgeConfigs.versionId, sourceVersionId), isNull(judgeConfigs.deletedAt)));

  if (jcRows.length > 0) {
    await tx.insert(judgeConfigs).values(
      jcRows.map((j) => ({
        agentId,
        versionId: targetVersionId,
        key: j.key,
        name: j.name,
        isActive: j.isActive,
        dimensions: j.dimensions,
        promptTemplate: j.promptTemplate,
        turnPromptTemplate: j.turnPromptTemplate,
      }))
    );
  }

  // ── 13. MCP Servers ──
  const mcpRows = await tx
    .select()
    .from(mcpServers)
    .where(and(eq(mcpServers.versionId, sourceVersionId), isNull(mcpServers.deletedAt)));

  if (mcpRows.length > 0) {
    await tx.insert(mcpServers).values(
      mcpRows.map((s) => ({
        agentId,
        versionId: targetVersionId,
        key: s.key,
        name: s.name,
        description: s.description,
        url: s.url,
        transportType: s.transportType,
        headers: s.headers,
        enabled: s.enabled,
        origin: s.origin,
      }))
    );
  }

  // ── 14. Skills ──
  const skillRows = await tx
    .select()
    .from(skills)
    .where(and(eq(skills.versionId, sourceVersionId), isNull(skills.deletedAt)));

  if (skillRows.length > 0) {
    await tx.insert(skills).values(
      skillRows.map((s) => ({
        agentId,
        versionId: targetVersionId,
        key: s.key,
        name: s.name,
        description: s.description,
        content: s.content,
        enabled: s.enabled,
        order: s.order,
      }))
    );
  }

  // ── 15. Memory Configs ──
  const memCfgRows = await tx
    .select()
    .from(memoryConfigs)
    .where(eq(memoryConfigs.versionId, sourceVersionId));

  if (memCfgRows.length > 0) {
    await tx.insert(memoryConfigs).values(
      memCfgRows.map((m) => ({
        agentId,
        versionId: targetVersionId,
        autoExtract: m.autoExtract,
        extractionPrompt: m.extractionPrompt,
        injectionMode: m.injectionMode,
        maxInjectedMemories: m.maxInjectedMemories,
        maxMemoriesPerUser: m.maxMemoriesPerUser,
        maxGlobalMemories: m.maxGlobalMemories,
        decayEnabled: m.decayEnabled,
        decayDays: m.decayDays,
        memoryTypeDefs: m.memoryTypeDefs,
      }))
    );
  }

  // ── 16. Agent Resource Refs (pool references — resourceId stays the same) ──
  const refRows = await tx
    .select()
    .from(agentResourceRefs)
    .where(eq(agentResourceRefs.versionId, sourceVersionId));

  if (refRows.length > 0) {
    await tx.insert(agentResourceRefs).values(
      refRows.map((r) => ({
        agentId,
        versionId: targetVersionId,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        enabled: r.enabled,
      }))
    );
  }
}
