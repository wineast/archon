CREATE TABLE "eval_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"repeat_count" integer DEFAULT 1 NOT NULL,
	"run_concurrency" integer DEFAULT 1 NOT NULL,
	"chat_model" text NOT NULL,
	"judge_config_snapshot" jsonb,
	"total_cases_per_run" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_runs" integer DEFAULT 0 NOT NULL,
	"total_runs" integer NOT NULL,
	"passed_assertions" integer DEFAULT 0 NOT NULL,
	"average_score" real,
	"score_std_dev" real,
	"min_score" real,
	"max_score" real,
	"is_baseline" boolean DEFAULT false NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "run_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_batches" ADD CONSTRAINT "eval_batches_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_batch_id_eval_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."eval_batches"("id") ON DELETE cascade ON UPDATE no action;