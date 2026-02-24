ALTER TABLE "eval_runs" ADD COLUMN "chat_temperature" real DEFAULT 0.7 NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "completed_cases" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD COLUMN "error" text;