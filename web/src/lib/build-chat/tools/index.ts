import { buildToolTools } from "./tool-tools";
import { buildSchemaTools } from "./schema-tools";
import { buildWikiTools } from "./wiki-tools";
import { buildDatasetTools } from "./dataset-tools";
import { buildFunctionTools } from "./function-tools";
import { buildComponentTools } from "./component-tools";
import { buildModelConfigTools } from "./model-config-tools";
import { buildChatConfigTools } from "./chat-config-tools";
import { buildOntologyTools } from "./ontology-tools";

/**
 * Build all server-side tools for the Build Chat assistant.
 * Each tool operates directly on the database via Drizzle ORM.
 */
export function buildAllTools(agentId: string) {
  return {
    ...buildToolTools(agentId),
    ...buildSchemaTools(agentId),
    ...buildWikiTools(agentId),
    ...buildDatasetTools(agentId),
    ...buildFunctionTools(agentId),
    ...buildComponentTools(agentId),
    ...buildModelConfigTools(agentId),
    ...buildChatConfigTools(agentId),
    ...buildOntologyTools(agentId),
  };
}
