CREATE TABLE "agent_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_members_agent_user_idx" UNIQUE("agent_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT 'bot' NOT NULL,
	"slug" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chat_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"title" text DEFAULT '' NOT NULL,
	"welcome_title" text DEFAULT '' NOT NULL,
	"welcome_icon" text DEFAULT '' NOT NULL,
	"quick_actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"placeholder" text DEFAULT '' NOT NULL,
	"suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_configs_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"user_id" uuid,
	"title" text NOT NULL,
	"model" text NOT NULL,
	"system_prompt" text,
	"message_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"share_id" text,
	"shared_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_sessions_share_id_unique" UNIQUE("share_id")
);
--> statement-breakpoint
CREATE TABLE "data_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_objects_agent_id_key_idx" UNIQUE("agent_id","key")
);
--> statement-breakpoint
CREATE TABLE "eval_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"name" text NOT NULL,
	"input" text NOT NULL,
	"expected_output" text,
	"assertions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eval_cases_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "eval_judge_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"name" text NOT NULL,
	"model" text NOT NULL,
	"system_prompt" text NOT NULL,
	"temperature" real NOT NULL,
	"dimensions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eval_judge_configs_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "eval_run_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"case_id" text NOT NULL,
	"case_name" text NOT NULL,
	"input" text NOT NULL,
	"chat_response" text,
	"assertion_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"all_assertions_passed" boolean NOT NULL,
	"judge_result" jsonb,
	"error" text,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"chat_model" text NOT NULL,
	"chat_system_prompt" text NOT NULL,
	"judge_config_id" uuid,
	"judge_config_name" text NOT NULL,
	"filter_tags" text[] DEFAULT '{}' NOT NULL,
	"total_cases" integer NOT NULL,
	"passed_assertions" integer NOT NULL,
	"average_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lookup_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"value" text NOT NULL,
	"label" text,
	"metadata" jsonb,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lookup_entries_table_id_value_idx" UNIQUE("table_id","value")
);
--> statement-breakpoint
CREATE TABLE "lookup_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lookup_tables_agent_id_key_idx" UNIQUE("agent_id","key")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"name" text NOT NULL,
	"model_id" text DEFAULT '' NOT NULL,
	"system_prompt" text DEFAULT '' NOT NULL,
	"temperature" real DEFAULT 0.7 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_configs_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "template_vars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"key" text NOT NULL,
	"description" text,
	"value" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"is_array" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_vars_agent_id_key_idx" UNIQUE("agent_id","key")
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"parameters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"output" text,
	"handler" text,
	"component" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tools_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"nickname" text,
	"avatar_url" text,
	"bio" text,
	"platform_role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
CREATE TABLE "wiki_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" uuid,
	"parent_id" text,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_members" ADD CONSTRAINT "agent_members_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_members" ADD CONSTRAINT "agent_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_configs" ADD CONSTRAINT "chat_configs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_objects" ADD CONSTRAINT "data_objects_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_cases" ADD CONSTRAINT "eval_cases_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_judge_configs" ADD CONSTRAINT "eval_judge_configs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_run_results" ADD CONSTRAINT "eval_run_results_run_id_eval_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."eval_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lookup_entries" ADD CONSTRAINT "lookup_entries_table_id_lookup_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."lookup_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lookup_tables" ADD CONSTRAINT "lookup_tables_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_configs" ADD CONSTRAINT "model_configs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_vars" ADD CONSTRAINT "template_vars_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_documents" ADD CONSTRAINT "wiki_documents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_members_user_id_idx" ON "agent_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "eval_run_results_run_id_idx" ON "eval_run_results" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "lookup_entries_table_id_idx" ON "lookup_entries" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "messages_session_id_idx" ON "messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "messages_session_id_created_at_idx" ON "messages" USING btree ("session_id","created_at");