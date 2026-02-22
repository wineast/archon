import {
  tools,
  components,
  functions,
  datasets,
  wikiDocuments,
  schemas,
  mcpServers,
} from "@/db/schema";
import type { ResourceType } from "@/db/schema";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const RESOURCE_TABLE_MAP: Record<ResourceType, PgTableWithColumns<any>> = {
  tool: tools,
  component: components,
  function: functions,
  dataset: datasets,
  wiki: wikiDocuments,
  schema: schemas,
  "mcp-server": mcpServers,
} as const;
