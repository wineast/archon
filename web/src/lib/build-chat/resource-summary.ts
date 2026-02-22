import { db } from "@/db";
import {
  agents,
  modelConfigs,
  chatConfigs,
  objectTypes,
  objectRelations,
  skills,
} from "@/db/schema";
import type {
  ToolRow,
  SchemaRow,
  WikiDocumentRow,
  DatasetRow,
  FunctionRow,
  ComponentRow,
  McpServerRow,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAgentResources } from "@/lib/pool/queries";

export interface ResourceSummary {
  tools: { id: string; key: string; name: string; description: string; enabled: boolean }[];
  schemas: { id: string; key: string; name: string; description: string }[];
  wiki: { id: string; key: string; name: string }[];
  datasets: { id: string; key: string; name: string; description: string }[];
  functions: { id: string; key: string; name: string; description: string }[];
  components: { id: string; key: string; name: string; description: string; toolInputSchema: import("@/lib/schemas/types").JsonSchema7 | null }[];
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
  mcpServers: {
    id: string;
    key: string;
    name: string;
    description: string;
    url: string;
    transportType: string;
    enabled: boolean;
  }[];
  skills: { id: string; key: string; name: string; description: string; enabled: boolean; order: number }[];
}

/**
 * Gather lightweight summaries of all resources for a given agent.
 * Only selects id, key, name, description — no large content fields.
 */
export async function gatherResourceSummary(
  agentId: string,
  versionId: string,
): Promise<ResourceSummary> {
  // Check if skills feature is enabled for this agent
  const [agentRow] = await db
    .select({ skillsEnabled: agents.skillsEnabled })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);
  const skillsFeatureEnabled = agentRow?.skillsEnabled !== false;

  const [
    allToolRows,
    allSchemaRows,
    allWikiRows,
    allDatasetRows,
    allFunctionRows,
    allComponentRows,
    modelConfigRows,
    chatConfigRows,
    objectTypeRows,
    objectRelationRows,
    allMcpServerRows,
    skillRows,
  ] = await Promise.all([
    getAgentResources<ToolRow>(agentId, "tool", versionId),
    getAgentResources<SchemaRow>(agentId, "schema", versionId),
    getAgentResources<WikiDocumentRow>(agentId, "wiki", versionId),
    getAgentResources<DatasetRow>(agentId, "dataset", versionId),
    getAgentResources<FunctionRow>(agentId, "function", versionId),
    getAgentResources<ComponentRow>(agentId, "component", versionId),
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
    getAgentResources<McpServerRow>(agentId, "mcp-server", versionId),
    skillsFeatureEnabled
      ? db
          .select({
            id: skills.id,
            key: skills.key,
            name: skills.name,
            description: skills.description,
            enabled: skills.enabled,
            order: skills.order,
          })
          .from(skills)
          .where(eq(skills.agentId, agentId))
      : Promise.resolve([]),
  ]);

  return {
    tools: allToolRows.map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, enabled: r.enabled })),
    schemas: allSchemaRows.map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description })),
    wiki: allWikiRows.map((r) => ({ id: r.id, key: r.key, name: r.name })),
    datasets: allDatasetRows.map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description })),
    functions: allFunctionRows.map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description })),
    components: allComponentRows.map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, toolInputSchema: r.toolInputSchema })),
    modelConfigs: modelConfigRows,
    chatConfig: chatConfigRows[0] ?? null,
    objectTypes: objectTypeRows,
    objectRelations: objectRelationRows,
    mcpServers: allMcpServerRows.map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, url: r.url, transportType: r.transportType, enabled: r.enabled })),
    skills: skillRows,
  };
}
