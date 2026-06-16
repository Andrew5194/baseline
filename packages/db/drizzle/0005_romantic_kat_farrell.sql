CREATE TABLE "category_colors" (
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"color" text NOT NULL,
	CONSTRAINT "category_colors_user_id_category_pk" PRIMARY KEY("user_id","category")
);
--> statement-breakpoint
CREATE TABLE "recurring_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"duration_ms" bigint NOT NULL,
	"days_mask" integer DEFAULT 127 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category_colors" ADD CONSTRAINT "category_colors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_allocations" ADD CONSTRAINT "recurring_allocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_allocations_user_idx" ON "recurring_allocations" USING btree ("user_id");