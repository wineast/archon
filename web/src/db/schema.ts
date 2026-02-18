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
} from "drizzle-orm/pg-core";
import type { ToolParameter } from "@/lib/tools/types";
import type { Assertion, AssertionResult, Dimension, JudgeResult } from "@/lib/eval/types";

/* ─────────── Agent Role Constants ─────────── */

export const AGENT_ROLE_LEVELS = { viewer: 0, editor: 1, admin: 2, owner: 3 } as const;
export type AgentRole = keyof typeof AGENT_ROLE_LEVELS;

/* ─────────── Agents ─────────── */

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  icon: text("icon").notNull().default("bot"),
  slug: text("slug").notNull().unique(),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

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

export const chatSessions = pgTable("chat_sessions", {
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
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;

export const templateVars = pgTable(
  "template_vars",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    description: text("description"),
    value: text("value").notNull().default(""),
    type: text("type").notNull().default("text").$type<
      "text" | "number" | "boolean" | "json"
    >(),
    isArray: boolean("is_array").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("template_vars_agent_id_key_idx").on(table.agentId, table.key),
  ]
);

export type TemplateVarRow = typeof templateVars.$inferSelect;
export type NewTemplateVarRow = typeof templateVars.$inferInsert;

export const wikiDocuments = pgTable("wiki_documents", {
  id: text("id").primaryKey(),
  agentId: uuid("agent_id").references(() => agents.id, {
    onDelete: "cascade",
  }),
  parentId: text("parent_id"),
  title: text("title").notNull().default("Untitled"),
  content: text("content").notNull().default(""),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type WikiDocumentRow = typeof wikiDocuments.$inferSelect;
export type NewWikiDocumentRow = typeof wikiDocuments.$inferInsert;

export const tools = pgTable("tools", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").references(() => agents.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  parameters: jsonb("parameters").$type<ToolParameter[]>().notNull().default([]),
  output: text("output"),
  handler: text("handler"),
  component: text("component"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

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

export const modelConfigs = pgTable("model_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").references(() => agents.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull().unique(),
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
});

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

export const evalCases = pgTable("eval_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").references(() => agents.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull().unique(),
  input: text("input").notNull(),
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
});

export type EvalCaseRow = typeof evalCases.$inferSelect;
export type NewEvalCaseRow = typeof evalCases.$inferInsert;

export const evalJudgeConfigs = pgTable("eval_judge_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").references(() => agents.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull().unique(),
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
});

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
    input: text("input").notNull(),
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

/* ─────────── Lookup Tables ─────────── */

export const lookupTables = pgTable(
  "lookup_tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("lookup_tables_agent_id_key_idx").on(table.agentId, table.key),
  ]
);

export type LookupTableRow = typeof lookupTables.$inferSelect;
export type NewLookupTableRow = typeof lookupTables.$inferInsert;

export const lookupEntries = pgTable(
  "lookup_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tableId: uuid("table_id")
      .notNull()
      .references(() => lookupTables.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    label: text("label"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("lookup_entries_table_id_value_idx").on(table.tableId, table.value),
    index("lookup_entries_table_id_idx").on(table.tableId),
  ]
);

export type LookupEntryRow = typeof lookupEntries.$inferSelect;
export type NewLookupEntryRow = typeof lookupEntries.$inferInsert;

/* ─────────── Data Objects ─────────── */

export const dataObjects = pgTable(
  "data_objects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("data_objects_agent_id_key_idx").on(table.agentId, table.key),
  ]
);

export type DataObjectRow = typeof dataObjects.$inferSelect;
export type NewDataObjectRow = typeof dataObjects.$inferInsert;
