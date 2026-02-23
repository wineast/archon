CREATE TABLE "agent_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"size" integer NOT NULL,
	"content_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_files_agent_id_name_idx" UNIQUE("agent_id","name")
);
--> statement-breakpoint
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
CREATE TABLE "agent_resource_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_resource_refs_uniq" UNIQUE("version_id","resource_type","resource_id")
);
--> statement-breakpoint
CREATE TABLE "agent_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"slot_key" text NOT NULL,
	"target_agent_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_slots_agent_id_slot_key_idx" UNIQUE("agent_id","slot_key")
);
--> statement-breakpoint
CREATE TABLE "agent_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"version" text NOT NULL,
	"changelog" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_versions_agent_id_version_idx" UNIQUE("agent_id","version")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT 'bot' NOT NULL,
	"slug" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"mcp_enabled" boolean DEFAULT false NOT NULL,
	"editing_version_id" uuid,
	"published_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"memory_enabled" boolean DEFAULT false NOT NULL,
	"skills_enabled" boolean DEFAULT false NOT NULL,
	"rag_enabled" boolean DEFAULT false NOT NULL,
	"context_compression_enabled" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"resource_key" text,
	"resource_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"version_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"welcome_title" text DEFAULT '' NOT NULL,
	"welcome_icon" text DEFAULT '' NOT NULL,
	"quick_actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"placeholder" text DEFAULT '' NOT NULL,
	"suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enable_voice" boolean DEFAULT false NOT NULL,
	"enable_attachment" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_configs_version_id_idx" UNIQUE("version_id")
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
	"source" text DEFAULT 'chat' NOT NULL,
	"share_id" text,
	"shared_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_sessions_share_id_unique" UNIQUE("share_id")
);
--> statement-breakpoint
CREATE TABLE "component_test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid NOT NULL,
	"name" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"scenario" text DEFAULT 'tool' NOT NULL,
	"show_as_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_test_run_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"case_name" text NOT NULL,
	"data" jsonb NOT NULL,
	"passed" boolean NOT NULL,
	"error" text,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid NOT NULL,
	"filter_tags" text[] DEFAULT '{}' NOT NULL,
	"total_cases" integer NOT NULL,
	"passed_cases" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"version_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"component_source" text DEFAULT '' NOT NULL,
	"generated_css" text DEFAULT '' NOT NULL,
	"tool_input_schema" jsonb,
	"component_input_schema" jsonb,
	"origin" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "components_version_check" CHECK (agent_id IS NULL OR version_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"version_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"data" jsonb NOT NULL,
	"origin" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "datasets_version_check" CHECK (agent_id IS NULL OR version_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "embed_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token" text NOT NULL,
	"allowed_origins" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "embed_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "eval_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"version_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"mode" text DEFAULT 'single' NOT NULL,
	"turns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_output" text,
	"assertions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "eval_run_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"case_name" text NOT NULL,
	"mode" text DEFAULT 'single' NOT NULL,
	"turns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chat_messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"turn_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
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
	"judge_agent_id" uuid,
	"judge_model_config_snapshot" jsonb,
	"judge_config_snapshot" jsonb,
	"filter_tags" text[] DEFAULT '{}' NOT NULL,
	"assertion_fail_config" jsonb,
	"total_cases" integer NOT NULL,
	"passed_assertions" integer NOT NULL,
	"average_score" real,
	"is_baseline" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "function_test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"function_id" uuid NOT NULL,
	"name" text NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expected_output" jsonb,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"show_as_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "function_test_run_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"case_name" text NOT NULL,
	"input" jsonb NOT NULL,
	"expected_output" jsonb,
	"output" jsonb,
	"passed" boolean NOT NULL,
	"error" text,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "function_test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"function_id" uuid NOT NULL,
	"filter_tags" text[] DEFAULT '{}' NOT NULL,
	"total_cases" integer NOT NULL,
	"passed_cases" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "functions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"version_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"code" text NOT NULL,
	"parameters_schema" jsonb,
	"return_parameters_schema" jsonb,
	"origin" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "functions_version_check" CHECK (agent_id IS NULL OR version_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "invitation_code_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_code_usages_code_user_idx" UNIQUE("code_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "invitation_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "judge_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"version_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"dimensions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mcp_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"version_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"transport_type" text DEFAULT 'sse' NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"origin" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "mcp_servers_version_check" CHECK (agent_id IS NULL OR version_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"user_id" text,
	"session_id" uuid,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"importance" real DEFAULT 0.5 NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"metadata" jsonb,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "memory_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"version_id" uuid NOT NULL,
	"embedding_model" text DEFAULT 'openai/text-embedding-3-small' NOT NULL,
	"auto_extract" boolean DEFAULT false NOT NULL,
	"extraction_prompt" text DEFAULT '' NOT NULL,
	"max_memories_per_user" integer DEFAULT 100 NOT NULL,
	"max_global_memories" integer DEFAULT 1000 NOT NULL,
	"injection_mode" text DEFAULT 'system_prompt' NOT NULL,
	"max_injected_memories" integer DEFAULT 10 NOT NULL,
	"decay_enabled" boolean DEFAULT false NOT NULL,
	"decay_days" integer DEFAULT 90 NOT NULL,
	"memory_type_defs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memory_configs_version_id_idx" UNIQUE("version_id")
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
	"version_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"model_id" text DEFAULT '' NOT NULL,
	"system_prompt" text DEFAULT '' NOT NULL,
	"temperature" real DEFAULT 0.7 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" text NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"type" text DEFAULT 'chat' NOT NULL,
	"context_window" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "models_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE TABLE "object_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"object_type_id" uuid NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "object_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"relation_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "object_links_relation_source_target_idx" UNIQUE("relation_id","source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "object_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source_type_id" uuid NOT NULL,
	"target_type_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"inverse_name" text DEFAULT '' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "object_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT 'box' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"schema_id" uuid,
	"title_property" text,
	"source" text DEFAULT 'internal' NOT NULL,
	"external_config" jsonb,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "org_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_api_keys_org_id_provider_idx" UNIQUE("org_id","provider")
);
--> statement-breakpoint
CREATE TABLE "org_credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"amount" numeric NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"created_by" uuid,
	"balance_after" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_members_org_user_idx" UNIQUE("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "org_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"slot_key" text NOT NULL,
	"target_agent_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_slots_org_id_slot_key_idx" UNIQUE("org_id","slot_key")
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_personal" boolean DEFAULT false NOT NULL,
	"avatar_url" text,
	"credit_balance_usd" numeric DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rag_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"content" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"embedding" vector,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"embedding_model" text DEFAULT 'openai/text-embedding-3-small' NOT NULL,
	"chunk_size" integer DEFAULT 500 NOT NULL,
	"chunk_overlap" integer DEFAULT 50 NOT NULL,
	"top_k" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rag_configs_agent_id_idx" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "rag_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"size" integer NOT NULL,
	"content_type" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runtime_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"session_id" uuid,
	"event_type" text NOT NULL,
	"severity" text NOT NULL,
	"metadata" jsonb,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_id" uuid NOT NULL,
	"name" text NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"should_pass" boolean DEFAULT true NOT NULL,
	"expected_errors" jsonb,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"show_as_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_test_run_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"case_name" text NOT NULL,
	"input" jsonb NOT NULL,
	"should_pass" boolean NOT NULL,
	"expected_errors" jsonb,
	"actual_valid" boolean NOT NULL,
	"actual_errors" jsonb,
	"passed" boolean NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_id" uuid NOT NULL,
	"filter_tags" text[] DEFAULT '{}' NOT NULL,
	"total_cases" integer NOT NULL,
	"passed_cases" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schemas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"version_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"origin" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "schemas_version_check" CHECK (agent_id IS NULL OR version_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"version_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tool_test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"name" text NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expected_output" jsonb,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"assertions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"show_as_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_test_run_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"case_name" text NOT NULL,
	"input" jsonb NOT NULL,
	"expected_output" jsonb,
	"output" jsonb,
	"passed" boolean NOT NULL,
	"error" text,
	"assertion_results" jsonb,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"filter_tags" text[] DEFAULT '{}' NOT NULL,
	"total_cases" integer NOT NULL,
	"passed_cases" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"version_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"parameters_schema" jsonb,
	"return_parameters_schema" jsonb,
	"handler" text,
	"url" text,
	"component_id" uuid,
	"enabled" boolean DEFAULT true NOT NULL,
	"ui_hidden" boolean DEFAULT false NOT NULL,
	"execution_target" text DEFAULT 'server' NOT NULL,
	"sandbox_mode" text DEFAULT 'light' NOT NULL,
	"origin" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tools_version_check" CHECK (agent_id IS NULL OR version_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"agent_id" uuid,
	"user_id" uuid,
	"session_id" uuid,
	"model_id" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cached_input_tokens" integer DEFAULT 0 NOT NULL,
	"reasoning_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
CREATE TABLE "wiki_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"version_id" uuid,
	"parent_id" uuid,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"origin" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "wiki_documents_version_check" CHECK (agent_id IS NULL OR version_id IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "agent_files" ADD CONSTRAINT "agent_files_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_members" ADD CONSTRAINT "agent_members_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_members" ADD CONSTRAINT "agent_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_resource_refs" ADD CONSTRAINT "agent_resource_refs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_resource_refs" ADD CONSTRAINT "agent_resource_refs_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_slots" ADD CONSTRAINT "agent_slots_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_slots" ADD CONSTRAINT "agent_slots_target_agent_id_agents_id_fk" FOREIGN KEY ("target_agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_editing_version_id_agent_versions_id_fk" FOREIGN KEY ("editing_version_id") REFERENCES "public"."agent_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_published_version_id_agent_versions_id_fk" FOREIGN KEY ("published_version_id") REFERENCES "public"."agent_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_configs" ADD CONSTRAINT "chat_configs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_configs" ADD CONSTRAINT "chat_configs_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_test_cases" ADD CONSTRAINT "component_test_cases_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_test_run_results" ADD CONSTRAINT "component_test_run_results_run_id_component_test_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."component_test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_test_runs" ADD CONSTRAINT "component_test_runs_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embed_tokens" ADD CONSTRAINT "embed_tokens_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_cases" ADD CONSTRAINT "eval_cases_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_cases" ADD CONSTRAINT "eval_cases_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_run_results" ADD CONSTRAINT "eval_run_results_run_id_eval_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."eval_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "function_test_cases" ADD CONSTRAINT "function_test_cases_function_id_functions_id_fk" FOREIGN KEY ("function_id") REFERENCES "public"."functions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "function_test_run_results" ADD CONSTRAINT "function_test_run_results_run_id_function_test_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."function_test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "function_test_runs" ADD CONSTRAINT "function_test_runs_function_id_functions_id_fk" FOREIGN KEY ("function_id") REFERENCES "public"."functions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functions" ADD CONSTRAINT "functions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functions" ADD CONSTRAINT "functions_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_code_usages" ADD CONSTRAINT "invitation_code_usages_code_id_invitation_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."invitation_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_code_usages" ADD CONSTRAINT "invitation_code_usages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_configs" ADD CONSTRAINT "judge_configs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_configs" ADD CONSTRAINT "judge_configs_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_configs" ADD CONSTRAINT "memory_configs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_configs" ADD CONSTRAINT "memory_configs_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_configs" ADD CONSTRAINT "model_configs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_configs" ADD CONSTRAINT "model_configs_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_instances" ADD CONSTRAINT "object_instances_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_instances" ADD CONSTRAINT "object_instances_object_type_id_object_types_id_fk" FOREIGN KEY ("object_type_id") REFERENCES "public"."object_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_links" ADD CONSTRAINT "object_links_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_links" ADD CONSTRAINT "object_links_relation_id_object_relations_id_fk" FOREIGN KEY ("relation_id") REFERENCES "public"."object_relations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_links" ADD CONSTRAINT "object_links_source_id_object_instances_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."object_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_links" ADD CONSTRAINT "object_links_target_id_object_instances_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."object_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_relations" ADD CONSTRAINT "object_relations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_relations" ADD CONSTRAINT "object_relations_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_relations" ADD CONSTRAINT "object_relations_source_type_id_object_types_id_fk" FOREIGN KEY ("source_type_id") REFERENCES "public"."object_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_relations" ADD CONSTRAINT "object_relations_target_type_id_object_types_id_fk" FOREIGN KEY ("target_type_id") REFERENCES "public"."object_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_types" ADD CONSTRAINT "object_types_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_types" ADD CONSTRAINT "object_types_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_types" ADD CONSTRAINT "object_types_schema_id_schemas_id_fk" FOREIGN KEY ("schema_id") REFERENCES "public"."schemas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_api_keys" ADD CONSTRAINT "org_api_keys_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_credit_transactions" ADD CONSTRAINT "org_credit_transactions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_credit_transactions" ADD CONSTRAINT "org_credit_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_slots" ADD CONSTRAINT "org_slots_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_slots" ADD CONSTRAINT "org_slots_target_agent_id_agents_id_fk" FOREIGN KEY ("target_agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_document_id_rag_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."rag_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_configs" ADD CONSTRAINT "rag_configs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runtime_events" ADD CONSTRAINT "runtime_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runtime_events" ADD CONSTRAINT "runtime_events_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schema_test_cases" ADD CONSTRAINT "schema_test_cases_schema_id_schemas_id_fk" FOREIGN KEY ("schema_id") REFERENCES "public"."schemas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schema_test_run_results" ADD CONSTRAINT "schema_test_run_results_run_id_schema_test_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."schema_test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schema_test_runs" ADD CONSTRAINT "schema_test_runs_schema_id_schemas_id_fk" FOREIGN KEY ("schema_id") REFERENCES "public"."schemas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schemas" ADD CONSTRAINT "schemas_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schemas" ADD CONSTRAINT "schemas_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_test_cases" ADD CONSTRAINT "tool_test_cases_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_test_run_results" ADD CONSTRAINT "tool_test_run_results_run_id_tool_test_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."tool_test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_test_runs" ADD CONSTRAINT "tool_test_runs_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_documents" ADD CONSTRAINT "wiki_documents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_documents" ADD CONSTRAINT "wiki_documents_version_id_agent_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."agent_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_documents" ADD CONSTRAINT "wiki_documents_parent_id_wiki_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."wiki_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_members_user_id_idx" ON "agent_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_resource_refs_resource_idx" ON "agent_resource_refs" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "agent_resource_refs_version_id_idx" ON "agent_resource_refs" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "agent_versions_agent_id_created_at_idx" ON "agent_versions" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_org_id_slug_idx" ON "agents" USING btree ("org_id","slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "audit_logs_agent_id_created_at_idx" ON "audit_logs" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_agent_id_resource_type_idx" ON "audit_logs" USING btree ("agent_id","resource_type");--> statement-breakpoint
CREATE INDEX "chat_configs_agent_id_idx" ON "chat_configs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_agent_id_idx" ON "chat_sessions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "component_test_cases_component_id_idx" ON "component_test_cases" USING btree ("component_id");--> statement-breakpoint
CREATE INDEX "component_test_run_results_run_id_idx" ON "component_test_run_results" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "components_version_id_key_idx" ON "components" USING btree ("version_id","key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "components_pool_key_idx" ON "components" USING btree ("key") WHERE agent_id IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "components_version_id_idx" ON "components" USING btree ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "datasets_version_id_key_idx" ON "datasets" USING btree ("version_id","key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "datasets_pool_key_idx" ON "datasets" USING btree ("key") WHERE agent_id IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "datasets_version_id_idx" ON "datasets" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "embed_tokens_agent_id_idx" ON "embed_tokens" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "eval_cases_version_id_key_idx" ON "eval_cases" USING btree ("version_id","key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "eval_cases_version_id_idx" ON "eval_cases" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "eval_run_results_run_id_idx" ON "eval_run_results" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "function_test_cases_function_id_idx" ON "function_test_cases" USING btree ("function_id");--> statement-breakpoint
CREATE INDEX "function_test_run_results_run_id_idx" ON "function_test_run_results" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "functions_version_id_key_idx" ON "functions" USING btree ("version_id","key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "functions_pool_key_idx" ON "functions" USING btree ("key") WHERE agent_id IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "functions_version_id_idx" ON "functions" USING btree ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "judge_configs_version_id_key_idx" ON "judge_configs" USING btree ("version_id","key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "judge_configs_version_id_idx" ON "judge_configs" USING btree ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_servers_version_id_key_idx" ON "mcp_servers" USING btree ("version_id","key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_servers_pool_key_idx" ON "mcp_servers" USING btree ("key") WHERE agent_id IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "mcp_servers_version_id_idx" ON "mcp_servers" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "memories_agent_id_user_id_idx" ON "memories" USING btree ("agent_id","user_id");--> statement-breakpoint
CREATE INDEX "memories_agent_id_type_idx" ON "memories" USING btree ("agent_id","type");--> statement-breakpoint
CREATE INDEX "memory_configs_agent_id_idx" ON "memory_configs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "messages_session_id_idx" ON "messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "messages_session_id_created_at_idx" ON "messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "model_configs_version_id_key_idx" ON "model_configs" USING btree ("version_id","key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "model_configs_version_id_idx" ON "model_configs" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "object_instances_agent_id_idx" ON "object_instances" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "object_instances_object_type_id_idx" ON "object_instances" USING btree ("object_type_id");--> statement-breakpoint
CREATE INDEX "object_links_relation_id_idx" ON "object_links" USING btree ("relation_id");--> statement-breakpoint
CREATE INDEX "object_links_source_id_idx" ON "object_links" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "object_links_target_id_idx" ON "object_links" USING btree ("target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "object_relations_version_id_key_idx" ON "object_relations" USING btree ("version_id","key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "object_relations_version_id_idx" ON "object_relations" USING btree ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "object_types_version_id_key_idx" ON "object_types" USING btree ("version_id","key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "object_types_version_id_idx" ON "object_types" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "org_api_keys_org_id_idx" ON "org_api_keys" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "org_credit_transactions_org_id_idx" ON "org_credit_transactions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "org_credit_transactions_org_id_created_at_idx" ON "org_credit_transactions" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "org_members_user_id_idx" ON "org_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orgs_slug_idx" ON "orgs" USING btree ("slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "rag_chunks_document_id_idx" ON "rag_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "rag_chunks_agent_id_idx" ON "rag_chunks" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "rag_documents_agent_id_idx" ON "rag_documents" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "runtime_events_agent_id_created_at_idx" ON "runtime_events" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "runtime_events_session_id_idx" ON "runtime_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "runtime_events_agent_id_event_type_idx" ON "runtime_events" USING btree ("agent_id","event_type");--> statement-breakpoint
CREATE INDEX "schema_test_cases_schema_id_idx" ON "schema_test_cases" USING btree ("schema_id");--> statement-breakpoint
CREATE INDEX "schema_test_run_results_run_id_idx" ON "schema_test_run_results" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schemas_version_id_key_idx" ON "schemas" USING btree ("version_id","key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "schemas_pool_key_idx" ON "schemas" USING btree ("key") WHERE agent_id IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "schemas_version_id_idx" ON "schemas" USING btree ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_version_id_key_idx" ON "skills" USING btree ("version_id","key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "skills_version_id_idx" ON "skills" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "tool_test_cases_tool_id_idx" ON "tool_test_cases" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "tool_test_run_results_run_id_idx" ON "tool_test_run_results" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tools_version_id_key_idx" ON "tools" USING btree ("version_id","key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tools_pool_key_idx" ON "tools" USING btree ("key") WHERE agent_id IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "tools_version_id_idx" ON "tools" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "usage_records_org_id_idx" ON "usage_records" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "usage_records_org_id_created_at_idx" ON "usage_records" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_records_agent_id_idx" ON "usage_records" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "usage_records_agent_id_created_at_idx" ON "usage_records" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_records_user_id_idx" ON "usage_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_records_source_idx" ON "usage_records" USING btree ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_documents_version_id_key_idx" ON "wiki_documents" USING btree ("version_id","key") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "wiki_documents_pool_key_idx" ON "wiki_documents" USING btree ("key") WHERE agent_id IS NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "wiki_documents_version_id_idx" ON "wiki_documents" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "wiki_documents_parent_id_idx" ON "wiki_documents" USING btree ("parent_id");