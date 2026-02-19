import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  boolean,
  jsonb,
  timestamp,
  index,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import type { ToolParameter } from "@/lib/tools/types";
import type { Assertion, AssertionResult, Dimension, JudgeResult, EvalCaseMode, EvalTurn, ChatMessage, TurnResult } from "@/lib/eval/types";

/* ─────────── Org Role Constants ─────────── */

export const ORG_ROLE_LEVELS = { member: 0, admin: 1, owner: 2 } as const;
export type OrgRole = keyof typeof ORG_ROLE_LEVELS;

/* ─────────── Organizations ─────────── */

export const orgs = pgTable("orgs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isPersonal: boolean("is_personal").notNull().default(false),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type OrgRow = typeof orgs.$inferSelect;
export type NewOrgRow = typeof orgs.$inferInsert;

/* ─────────── Org Members ─────────── */

export const orgMembers = pgTable(
  "org_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().$type<OrgRole>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("org_members_org_user_idx").on(t.orgId, t.userId),
    index("org_members_user_id_idx").on(t.userId),
  ]
);

export type OrgMemberRow = typeof orgMembers.$inferSelect;
export type NewOrgMemberRow = typeof orgMembers.$inferInsert;

/* ─────────── Agent Role Constants ─────────── */

export const AGENT_ROLE_LEVELS = { viewer: 0, editor: 1, admin: 2, owner: 3 } as const;
export type AgentRole = keyof typeof AGENT_ROLE_LEVELS;

/* ─────────── Agents ─────────── */

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("bot"),
    slug: text("slug").notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    editingVersionId: uuid("editing_version_id").references(
      (): AnyPgColumn => agentVersions.id,
      { onDelete: "set null" }
    ),
    publishedVersionId: uuid("published_version_id").references(
      (): AnyPgColumn => agentVersions.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    unique("agents_org_id_slug_idx").on(t.orgId, t.slug),
  ]
);

export type AgentRow = typeof agents.$inferSelect;
export type NewAgentRow = typeof agents.$inferInsert;

/* ─────────── Users ─────────── */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  nickname: text("nickname"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  platformRole: text("platform_role").notNull().default("user").$type<"user" | "super_admin">(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/* ─────────── Agent Members ─────────── */

export const agentMembers = pgTable(
  "agent_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().$type<AgentRole>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("agent_members_agent_user_idx").on(t.agentId, t.userId),
    index("agent_members_user_id_idx").on(t.userId),
  ]
);

export type AgentMemberRow = typeof agentMembers.$inferSelect;
export type NewAgentMemberRow = typeof agentMembers.$inferInsert;

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    model: text("model").notNull(),
    systemPrompt: text("system_prompt"),
    messageCount: integer("message_count").default(0).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    shareId: text("share_id").unique(),
    sharedAt: timestamp("shared_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("chat_sessions_agent_id_idx").on(table.agentId),
    index("chat_sessions_user_id_idx").on(table.userId),
  ]
);

export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;

/* ─────────── Functions (server-side reusable functions) ─────────── */

export const functions = pgTable(
  "functions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    code: text("code").notNull(),
    parametersSchemaId: uuid("parameters_schema_id").references(() => schemas.id, { onDelete: "set null" }),
    returnParametersSchemaId: uuid("return_parameters_schema_id").references(() => schemas.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("functions_agent_id_key_idx").on(table.agentId, table.key),
  ]
);

export type FunctionRow = typeof functions.$inferSelect;
export type NewFunctionRow = typeof functions.$inferInsert;

/* ─────────── Datasets (unified JSON store) ─────────── */

export const datasets = pgTable(
  "datasets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    data: jsonb("data").$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("datasets_agent_id_key_idx").on(table.agentId, table.key),
  ]
);

export type DatasetRow = typeof datasets.$inferSelect;
export type NewDatasetRow = typeof datasets.$inferInsert;

export const wikiDocuments = pgTable(
  "wiki_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "cascade",
    }),
    parentId: uuid("parent_id").references(() => wikiDocuments.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    key: text("key").notNull(),
    content: text("content").notNull().default(""),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("wiki_documents_agent_id_key_idx").on(table.agentId, table.key),
  ]
);

export type WikiDocumentRow = typeof wikiDocuments.$inferSelect;
export type NewWikiDocumentRow = typeof wikiDocuments.$inferInsert;

/* ─────────── Schemas (reusable parameter definitions) ─────────── */

export const schemas = pgTable(
  "schemas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    parameters: jsonb("parameters").$type<ToolParameter[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("schemas_agent_id_key_idx").on(table.agentId, table.key),
  ]
);

export type SchemaRow = typeof schemas.$inferSelect;
export type NewSchemaRow = typeof schemas.$inferInsert;

/** Computed type: SchemaRow + resolved includeSchemaIds from junction table */
export type SchemaWithIncludes = SchemaRow & { includeSchemaIds: string[] };

/* ─────────── Schema Includes (junction table) ─────────── */

export const schemaIncludes = pgTable(
  "schema_includes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schemaId: uuid("schema_id")
      .notNull()
      .references(() => schemas.id, { onDelete: "cascade" }),
    includeSchemaId: uuid("include_schema_id")
      .notNull()
      .references(() => schemas.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("schema_includes_schema_include_idx").on(t.schemaId, t.includeSchemaId),
    index("schema_includes_schema_id_idx").on(t.schemaId),
  ]
);

export type SchemaIncludeRow = typeof schemaIncludes.$inferSelect;
export type NewSchemaIncludeRow = typeof schemaIncludes.$inferInsert;

/* ─────────── Tools ─────────── */

export const tools = pgTable(
  "tools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    parametersSchemaId: uuid("parameters_schema_id").references(() => schemas.id, { onDelete: "set null" }),
    returnParametersSchemaId: uuid("return_parameters_schema_id").references(() => schemas.id, { onDelete: "set null" }),
    output: text("output"),
    handler: text("handler"),
    componentId: uuid("component_id").references(() => components.id, { onDelete: "set null" }),
    enabled: boolean("enabled").notNull().default(true),
    executionTarget: text("execution_target").notNull().default("server").$type<"server" | "client" | "host">(),
    sandboxMode: text("sandbox_mode").notNull().default("light").$type<"light" | "full">(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("tools_agent_id_key_idx").on(table.agentId, table.key),
  ]
);

export type ToolRow = typeof tools.$inferSelect;
export type NewToolRow = typeof tools.$inferInsert;

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull().$type<"user" | "assistant" | "system">(),
    parts: jsonb("parts").notNull().$type<unknown[]>(),
    content: text("content"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("messages_session_id_idx").on(table.sessionId),
    index("messages_session_id_created_at_idx").on(
      table.sessionId,
      table.createdAt
    ),
  ]
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export const modelConfigs = pgTable(
  "model_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    modelId: text("model_id").notNull().default(""),
    systemPrompt: text("system_prompt").notNull().default(""),
    temperature: real("temperature").notNull().default(0.7),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    unique("model_configs_agent_id_key_idx").on(t.agentId, t.key),
  ]
);

export type ModelConfigRow = typeof modelConfigs.$inferSelect;
export type NewModelConfigRow = typeof modelConfigs.$inferInsert;

export const chatConfigs = pgTable("chat_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id")
    .references(() => agents.id, { onDelete: "cascade" })
    .unique(),
  title: text("title").notNull().default(""),
  welcomeTitle: text("welcome_title").notNull().default(""),
  welcomeIcon: text("welcome_icon").notNull().default(""),
  quickActions: jsonb("quick_actions").$type<string[]>().notNull().default([]),
  placeholder: text("placeholder").notNull().default(""),
  suggestions: jsonb("suggestions").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type ChatConfigRow = typeof chatConfigs.$inferSelect;
export type NewChatConfigRow = typeof chatConfigs.$inferInsert;

export const evalCases = pgTable(
  "eval_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    mode: text("mode").notNull().default("single").$type<EvalCaseMode>(),
    turns: jsonb("turns").$type<EvalTurn[]>().notNull().default([]),
    expectedOutput: text("expected_output"),
    assertions: jsonb("assertions").$type<Assertion[]>().notNull().default([]),
    tags: text("tags").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    unique("eval_cases_agent_id_key_idx").on(t.agentId, t.key),
  ]
);

export type EvalCaseRow = typeof evalCases.$inferSelect;
export type NewEvalCaseRow = typeof evalCases.$inferInsert;

export const evalJudgeConfigs = pgTable(
  "eval_judge_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    model: text("model").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    temperature: real("temperature").notNull(),
    dimensions: jsonb("dimensions").$type<Dimension[]>().notNull().default([]),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    unique("eval_judge_configs_agent_id_key_idx").on(t.agentId, t.key),
  ]
);

export type EvalJudgeConfigRow = typeof evalJudgeConfigs.$inferSelect;
export type NewEvalJudgeConfigRow = typeof evalJudgeConfigs.$inferInsert;

export const evalRuns = pgTable("eval_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").references(() => agents.id, {
    onDelete: "cascade",
  }),
  chatModel: text("chat_model").notNull(),
  chatSystemPrompt: text("chat_system_prompt").notNull(),
  judgeConfigId: uuid("judge_config_id"),
  judgeConfigName: text("judge_config_name").notNull(),
  filterTags: text("filter_tags").array().notNull().default([]),
  totalCases: integer("total_cases").notNull(),
  passedAssertions: integer("passed_assertions").notNull(),
  averageScore: real("average_score"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type EvalRunRow = typeof evalRuns.$inferSelect;
export type NewEvalRunRow = typeof evalRuns.$inferInsert;

export const evalRunResults = pgTable(
  "eval_run_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => evalRuns.id, { onDelete: "cascade" }),
    caseId: text("case_id").notNull(),
    caseName: text("case_name").notNull(),
    mode: text("mode").notNull().default("single").$type<EvalCaseMode>(),
    turns: jsonb("turns").$type<EvalTurn[]>().notNull().default([]),
    chatMessages: jsonb("chat_messages").$type<ChatMessage[]>().notNull().default([]),
    turnResults: jsonb("turn_results").$type<TurnResult[]>().notNull().default([]),
    chatResponse: text("chat_response"),
    assertionResults: jsonb("assertion_results")
      .$type<AssertionResult[]>()
      .notNull()
      .default([]),
    allAssertionsPassed: boolean("all_assertions_passed").notNull(),
    judgeResult: jsonb("judge_result").$type<JudgeResult | null>(),
    error: text("error"),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("eval_run_results_run_id_idx").on(table.runId)]
);

export type EvalRunResultRow = typeof evalRunResults.$inferSelect;
export type NewEvalRunResultRow = typeof evalRunResults.$inferInsert;

/* ─────────── Function Test Cases ─────────── */

export const functionTestCases = pgTable(
  "function_test_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    functionId: uuid("function_id")
      .notNull()
      .references(() => functions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
    expectedOutput: jsonb("expected_output").$type<unknown>(),
    tags: text("tags").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("function_test_cases_function_id_idx").on(table.functionId),
  ]
);

export type FunctionTestCaseRow = typeof functionTestCases.$inferSelect;
export type NewFunctionTestCaseRow = typeof functionTestCases.$inferInsert;

/* ─────────── Function Test Runs ─────────── */

export const functionTestRuns = pgTable("function_test_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  functionId: uuid("function_id")
    .notNull()
    .references(() => functions.id, { onDelete: "cascade" }),
  filterTags: text("filter_tags").array().notNull().default([]),
  totalCases: integer("total_cases").notNull(),
  passedCases: integer("passed_cases").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type FunctionTestRunRow = typeof functionTestRuns.$inferSelect;
export type NewFunctionTestRunRow = typeof functionTestRuns.$inferInsert;

export const functionTestRunResults = pgTable(
  "function_test_run_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => functionTestRuns.id, { onDelete: "cascade" }),
    caseId: uuid("case_id").notNull(),
    caseName: text("case_name").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    expectedOutput: jsonb("expected_output").$type<unknown>(),
    output: jsonb("output").$type<unknown>(),
    passed: boolean("passed").notNull(),
    error: text("error"),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("function_test_run_results_run_id_idx").on(table.runId),
  ]
);

export type FunctionTestRunResultRow = typeof functionTestRunResults.$inferSelect;
export type NewFunctionTestRunResultRow = typeof functionTestRunResults.$inferInsert;

/* ─────────── Tool Test Cases ─────────── */

export const toolTestCases = pgTable(
  "tool_test_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    toolId: uuid("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
    expectedOutput: jsonb("expected_output").$type<unknown>(),
    tags: text("tags").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("tool_test_cases_tool_id_idx").on(table.toolId),
  ]
);

export type ToolTestCaseRow = typeof toolTestCases.$inferSelect;
export type NewToolTestCaseRow = typeof toolTestCases.$inferInsert;

/* ─────────── Tool Test Runs ─────────── */

export const toolTestRuns = pgTable("tool_test_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  toolId: uuid("tool_id")
    .notNull()
    .references(() => tools.id, { onDelete: "cascade" }),
  filterTags: text("filter_tags").array().notNull().default([]),
  totalCases: integer("total_cases").notNull(),
  passedCases: integer("passed_cases").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ToolTestRunRow = typeof toolTestRuns.$inferSelect;
export type NewToolTestRunRow = typeof toolTestRuns.$inferInsert;

export const toolTestRunResults = pgTable(
  "tool_test_run_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => toolTestRuns.id, { onDelete: "cascade" }),
    caseId: uuid("case_id").notNull(),
    caseName: text("case_name").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    expectedOutput: jsonb("expected_output").$type<unknown>(),
    output: jsonb("output").$type<unknown>(),
    passed: boolean("passed").notNull(),
    error: text("error"),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("tool_test_run_results_run_id_idx").on(table.runId),
  ]
);

export type ToolTestRunResultRow = typeof toolTestRunResults.$inferSelect;
export type NewToolTestRunResultRow = typeof toolTestRunResults.$inferInsert;

/* ─────────── Components (reusable UI components) ─────────── */

export const components = pgTable(
  "components",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    componentSource: text("component_source").notNull().default(""),
    generatedCss: text("generated_css").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("components_agent_id_key_idx").on(table.agentId, table.key),
  ]
);

export type ComponentRow = typeof components.$inferSelect;
export type NewComponentRow = typeof components.$inferInsert;

/* ─────────── Component Test Cases ─────────── */

export const componentTestCases = pgTable(
  "component_test_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    componentId: uuid("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tool: jsonb("tool")
      .$type<{ name: string; input: unknown; output: unknown }>()
      .notNull()
      .default({ name: "", input: {}, output: {} }),
    tags: text("tags").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("component_test_cases_component_id_idx").on(table.componentId),
  ]
);

export type ComponentTestCaseRow = typeof componentTestCases.$inferSelect;
export type NewComponentTestCaseRow = typeof componentTestCases.$inferInsert;

/* ─────────── Component Test Runs ─────────── */

export const componentTestRuns = pgTable("component_test_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  componentId: uuid("component_id")
    .notNull()
    .references(() => components.id, { onDelete: "cascade" }),
  filterTags: text("filter_tags").array().notNull().default([]),
  totalCases: integer("total_cases").notNull(),
  passedCases: integer("passed_cases").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ComponentTestRunRow = typeof componentTestRuns.$inferSelect;
export type NewComponentTestRunRow = typeof componentTestRuns.$inferInsert;

/* ─────────── Component Test Run Results ─────────── */

export const componentTestRunResults = pgTable(
  "component_test_run_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => componentTestRuns.id, { onDelete: "cascade" }),
    caseId: uuid("case_id").notNull(),
    caseName: text("case_name").notNull(),
    tool: jsonb("tool")
      .$type<{ name: string; input: unknown; output: unknown }>()
      .notNull(),
    passed: boolean("passed").notNull(),
    error: text("error"),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("component_test_run_results_run_id_idx").on(table.runId),
  ]
);

export type ComponentTestRunResultRow =
  typeof componentTestRunResults.$inferSelect;
export type NewComponentTestRunResultRow =
  typeof componentTestRunResults.$inferInsert;

/* ─────────── Agent Versions ─────────── */

export const agentVersions = pgTable(
  "agent_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    changelog: text("changelog").notNull().default(""),
    snapshot: jsonb("snapshot").notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("agent_versions_agent_id_version_idx").on(t.agentId, t.version),
    index("agent_versions_agent_id_created_at_idx").on(t.agentId, t.createdAt),
  ]
);

export type AgentVersionRow = typeof agentVersions.$inferSelect;
export type NewAgentVersionRow = typeof agentVersions.$inferInsert;

/* ─────────── Embed Tokens ─────────── */

export const embedTokens = pgTable(
  "embed_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    token: text("token").notNull().unique(),
    allowedOrigins: text("allowed_origins").array().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("embed_tokens_agent_id_idx").on(table.agentId),
    index("embed_tokens_token_idx").on(table.token),
  ]
);

export type EmbedTokenRow = typeof embedTokens.$inferSelect;
export type NewEmbedTokenRow = typeof embedTokens.$inferInsert;

/* ─────────── Agent Files (Vercel Blob) ─────────── */

export const agentFiles = pgTable(
  "agent_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    size: integer("size").notNull(),
    contentType: text("content_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("agent_files_agent_id_name_idx").on(t.agentId, t.name),
  ]
);

export type AgentFileRow = typeof agentFiles.$inferSelect;
export type NewAgentFileRow = typeof agentFiles.$inferInsert;

/* ─────────── Models (global model registry) ─────────── */

export const models = pgTable("models", {
  id: uuid("id").defaultRandom().primaryKey(),
  modelId: text("model_id").notNull().unique(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type ModelRow = typeof models.$inferSelect;
export type NewModelRow = typeof models.$inferInsert;

/* ─────────── Object Types (Ontology) ─────────── */

export const objectTypes = pgTable(
  "object_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("box"),
    color: text("color").notNull().default("#6366f1"),
    schemaId: uuid("schema_id").references(() => schemas.id, {
      onDelete: "set null",
    }),
    titleProperty: text("title_property"),
    source: text("source").notNull().default("internal").$type<"internal" | "external">(),
    externalConfig: jsonb("external_config").$type<Record<string, unknown>>(),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    unique("object_types_agent_id_key_idx").on(t.agentId, t.key),
  ]
);

export type ObjectTypeRow = typeof objectTypes.$inferSelect;
export type NewObjectTypeRow = typeof objectTypes.$inferInsert;

/* ─────────── Object Relations (Ontology) ─────────── */

export const objectRelations = pgTable(
  "object_relations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    sourceTypeId: uuid("source_type_id")
      .notNull()
      .references(() => objectTypes.id, { onDelete: "cascade" }),
    targetTypeId: uuid("target_type_id")
      .notNull()
      .references(() => objectTypes.id, { onDelete: "cascade" }),
    relationType: text("relation_type")
      .notNull()
      .$type<"has_one" | "has_many" | "belongs_to" | "many_to_many">(),
    inverseName: text("inverse_name").notNull().default(""),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    unique("object_relations_agent_id_key_idx").on(t.agentId, t.key),
  ]
);

export type ObjectRelationRow = typeof objectRelations.$inferSelect;
export type NewObjectRelationRow = typeof objectRelations.$inferInsert;

/* ─────────── Object Instances (Ontology) ─────────── */

export const objectInstances = pgTable(
  "object_instances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    objectTypeId: uuid("object_type_id")
      .notNull()
      .references(() => objectTypes.id, { onDelete: "cascade" }),
    label: text("label").notNull().default(""),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("object_instances_agent_id_idx").on(t.agentId),
    index("object_instances_object_type_id_idx").on(t.objectTypeId),
  ]
);

export type ObjectInstanceRow = typeof objectInstances.$inferSelect;
export type NewObjectInstanceRow = typeof objectInstances.$inferInsert;

/* ─────────── Object Links (Ontology) ─────────── */

export const objectLinks = pgTable(
  "object_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    relationId: uuid("relation_id")
      .notNull()
      .references(() => objectRelations.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => objectInstances.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => objectInstances.id, { onDelete: "cascade" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("object_links_relation_id_idx").on(t.relationId),
    index("object_links_source_id_idx").on(t.sourceId),
    index("object_links_target_id_idx").on(t.targetId),
  ]
);

export type ObjectLinkRow = typeof objectLinks.$inferSelect;
export type NewObjectLinkRow = typeof objectLinks.$inferInsert;

/* ─────────── Usage Records (LLM usage metering) ─────────── */

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => orgs.id, {
      onDelete: "set null",
    }),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sessionId: uuid("session_id").references(() => chatSessions.id, {
      onDelete: "set null",
    }),
    modelId: text("model_id").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    reasoningTokens: integer("reasoning_tokens").notNull().default(0),
    costUSD: real("cost_usd").notNull().default(0),
    source: text("source").notNull().$type<"chat" | "embed" | "prompt-assist" | "jsx-assist" | "eval">(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("usage_records_org_id_idx").on(t.orgId),
    index("usage_records_org_id_created_at_idx").on(t.orgId, t.createdAt),
    index("usage_records_agent_id_idx").on(t.agentId),
    index("usage_records_agent_id_created_at_idx").on(t.agentId, t.createdAt),
    index("usage_records_user_id_idx").on(t.userId),
    index("usage_records_source_idx").on(t.source),
  ]
);

export type UsageRecordRow = typeof usageRecords.$inferSelect;
export type NewUsageRecordRow = typeof usageRecords.$inferInsert;

/* ─────────── Platform Settings (singleton) ─────────── */

export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey().default("singleton"),
  buildChatModel: text("build_chat_model").notNull().default("anthropic/claude-sonnet-4"),
  buildChatTemperature: real("build_chat_temperature").notNull().default(0.3),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type PlatformSettingsRow = typeof platformSettings.$inferSelect;
export type NewPlatformSettingsRow = typeof platformSettings.$inferInsert;

/* ─────────── Audit Logs ─────────── */

export const auditLogActions = ["created", "updated", "deleted", "restored", "permanently_deleted"] as const;
export type AuditLogAction = (typeof auditLogActions)[number];

export const auditLogResourceTypes = [
  "tool", "function", "component", "schema", "dataset", "wiki",
  "model_config", "eval_case", "eval_judge_config",
  "object_type", "object_relation", "chat_config",
] as const;
export type AuditLogResourceType = (typeof auditLogResourceTypes)[number];

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull().$type<AuditLogAction>(),
    resourceType: text("resource_type").notNull().$type<AuditLogResourceType>(),
    resourceId: uuid("resource_id").notNull(),
    resourceKey: text("resource_key"),
    resourceName: text("resource_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("audit_logs_agent_id_created_at_idx").on(t.agentId, t.createdAt),
    index("audit_logs_agent_id_resource_type_idx").on(t.agentId, t.resourceType),
  ]
);

export type AuditLogRow = typeof auditLogs.$inferSelect;
export type NewAuditLogRow = typeof auditLogs.$inferInsert;

/* ─────────── Runtime Events ─────────── */

export const runtimeEventTypes = [
  "llm_call",
  "tool_call",
  "tool_error",
  "tool_timeout",
  "stream_error",
] as const;
export type RuntimeEventType = (typeof runtimeEventTypes)[number];

export const runtimeEventSeverities = ["info", "warning", "error"] as const;
export type RuntimeEventSeverity = (typeof runtimeEventSeverities)[number];

export const runtimeEvents = pgTable(
  "runtime_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => chatSessions.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type").notNull().$type<RuntimeEventType>(),
    severity: text("severity").notNull().$type<RuntimeEventSeverity>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("runtime_events_agent_id_created_at_idx").on(t.agentId, t.createdAt),
    index("runtime_events_session_id_idx").on(t.sessionId),
    index("runtime_events_agent_id_event_type_idx").on(t.agentId, t.eventType),
  ]
);

export type RuntimeEventRow = typeof runtimeEvents.$inferSelect;
export type NewRuntimeEventRow = typeof runtimeEvents.$inferInsert;

