import { db } from "@/db";
import {
  tools,
  schemas,
  wikiDocuments,
  datasets,
  functions,
  components,
  modelConfigs,
  chatConfigs,
  objectTypes,
  objectRelations,
} from "@/db/schema";
import { eq } from "drizzle-orm";

export interface ResourceSummary {
  tools: { id: string; key: string; name: string; description: string; enabled: boolean }[];
  schemas: { id: string; key: string; name: string; description: string }[];
  wiki: { id: string; key: string; name: string }[];
  datasets: { id: string; key: string; name: string; description: string }[];
  functions: { id: string; key: string; name: string; description: string }[];
  components: { id: string; key: string; name: string; description: string; toolInputSchemaId: string | null; toolOutputSchemaId: string | null }[];
  modelConfigs: { id: string; key: string; name: string; modelId: string; isActive: boolean }[];
  chatConfig: {
    id: string;
    title: string;
    welcomeTitle: string;
    placeholder: string;
    suggestions: string[];
  } | null;
  objectTypes: { id: string; key: string; name: string; description: string }[];
  objectRelations: {
    id: string;
    key: string;
    name: string;
    sourceTypeId: string;
    targetTypeId: string;
    relationType: string;
  }[];
}

/**
 * Gather lightweight summaries of all resources for a given agent.
 * Only selects id, key, name, description — no large content fields.
 */
export async function gatherResourceSummary(
  agentId: string
): Promise<ResourceSummary> {
  const [
    toolRows,
    schemaRows,
    wikiRows,
    datasetRows,
    functionRows,
    componentRows,
    modelConfigRows,
    chatConfigRows,
    objectTypeRows,
    objectRelationRows,
  ] = await Promise.all([
    db
      .select({
        id: tools.id,
        key: tools.key,
        name: tools.name,
        description: tools.description,
        enabled: tools.enabled,
      })
      .from(tools)
      .where(eq(tools.agentId, agentId)),
    db
      .select({
        id: schemas.id,
        key: schemas.key,
        name: schemas.name,
        description: schemas.description,
      })
      .from(schemas)
      .where(eq(schemas.agentId, agentId)),
    db
      .select({
        id: wikiDocuments.id,
        key: wikiDocuments.key,
        name: wikiDocuments.name,
      })
      .from(wikiDocuments)
      .where(eq(wikiDocuments.agentId, agentId)),
    db
      .select({
        id: datasets.id,
        key: datasets.key,
        name: datasets.name,
        description: datasets.description,
      })
      .from(datasets)
      .where(eq(datasets.agentId, agentId)),
    db
      .select({
        id: functions.id,
        key: functions.key,
        name: functions.name,
        description: functions.description,
      })
      .from(functions)
      .where(eq(functions.agentId, agentId)),
    db
      .select({
        id: components.id,
        key: components.key,
        name: components.name,
        description: components.description,
        toolInputSchemaId: components.toolInputSchemaId,
        toolOutputSchemaId: components.toolOutputSchemaId,
      })
      .from(components)
      .where(eq(components.agentId, agentId)),
    db
      .select({
        id: modelConfigs.id,
        key: modelConfigs.key,
        name: modelConfigs.name,
        modelId: modelConfigs.modelId,
        isActive: modelConfigs.isActive,
      })
      .from(modelConfigs)
      .where(eq(modelConfigs.agentId, agentId)),
    db
      .select({
        id: chatConfigs.id,
        title: chatConfigs.title,
        welcomeTitle: chatConfigs.welcomeTitle,
        placeholder: chatConfigs.placeholder,
        suggestions: chatConfigs.suggestions,
      })
      .from(chatConfigs)
      .where(eq(chatConfigs.agentId, agentId))
      .limit(1),
    db
      .select({
        id: objectTypes.id,
        key: objectTypes.key,
        name: objectTypes.name,
        description: objectTypes.description,
      })
      .from(objectTypes)
      .where(eq(objectTypes.agentId, agentId)),
    db
      .select({
        id: objectRelations.id,
        key: objectRelations.key,
        name: objectRelations.name,
        sourceTypeId: objectRelations.sourceTypeId,
        targetTypeId: objectRelations.targetTypeId,
        relationType: objectRelations.relationType,
      })
      .from(objectRelations)
      .where(eq(objectRelations.agentId, agentId)),
  ]);

  return {
    tools: toolRows,
    schemas: schemaRows,
    wiki: wikiRows,
    datasets: datasetRows,
    functions: functionRows,
    components: componentRows,
    modelConfigs: modelConfigRows,
    chatConfig: chatConfigRows[0] ?? null,
    objectTypes: objectTypeRows,
    objectRelations: objectRelationRows,
  };
}
