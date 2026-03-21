ALTER TABLE "model_configs" ALTER COLUMN "temperature" SET DEFAULT 0.3;--> statement-breakpoint
ALTER TABLE "chat_configs" ADD COLUMN "welcome_subtitle" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_configs" ADD COLUMN "quick_buttons" jsonb DEFAULT '[]'::jsonb NOT NULL;