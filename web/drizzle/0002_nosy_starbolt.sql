CREATE TABLE "tool_test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"name" text NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expected_output" jsonb,
	"tags" text[] DEFAULT '{}' NOT NULL,
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
ALTER TABLE "tool_test_cases" ADD CONSTRAINT "tool_test_cases_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_test_run_results" ADD CONSTRAINT "tool_test_run_results_run_id_tool_test_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."tool_test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_test_runs" ADD CONSTRAINT "tool_test_runs_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tool_test_cases_tool_id_idx" ON "tool_test_cases" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "tool_test_run_results_run_id_idx" ON "tool_test_run_results" USING btree ("run_id");--> statement-breakpoint
ALTER TABLE "tools" DROP COLUMN "output";