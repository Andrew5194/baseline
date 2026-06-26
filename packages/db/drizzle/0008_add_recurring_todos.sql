CREATE TABLE "recurring_todo_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recurring_todo_id" uuid NOT NULL,
	"date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"days_mask" integer DEFAULT 127 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_todo_completions" ADD CONSTRAINT "recurring_todo_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_todo_completions" ADD CONSTRAINT "recurring_todo_completions_recurring_todo_id_recurring_todos_id_fk" FOREIGN KEY ("recurring_todo_id") REFERENCES "public"."recurring_todos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_todos" ADD CONSTRAINT "recurring_todos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_todo_completions_idx" ON "recurring_todo_completions" USING btree ("recurring_todo_id","date");--> statement-breakpoint
CREATE INDEX "recurring_todo_completions_user_idx" ON "recurring_todo_completions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recurring_todos_user_idx" ON "recurring_todos" USING btree ("user_id");