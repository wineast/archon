ALTER TABLE "eval_runs" ADD COLUMN "template_vars" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "tool_names" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "eval_run_results_run_id_case_id_idx" ON "eval_run_results" USING btree ("run_id","case_id");