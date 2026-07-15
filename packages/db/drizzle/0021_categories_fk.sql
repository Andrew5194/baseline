CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "categories_user_name_idx" ON "categories" ("user_id","name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_user_idx" ON "categories" ("user_id");
--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "category_id" uuid;
--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "category_id" uuid;
--> statement-breakpoint
ALTER TABLE "recurring_todos" ADD COLUMN IF NOT EXISTS "category_id" uuid;
--> statement-breakpoint
ALTER TABLE "recurring_allocations" ADD COLUMN IF NOT EXISTS "category_id" uuid;
--> statement-breakpoint
INSERT INTO "categories" ("user_id","name") SELECT DISTINCT "user_id", trim("category") FROM "goals" WHERE "category" IS NOT NULL AND trim("category") <> '' ON CONFLICT ("user_id","name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "categories" ("user_id","name") SELECT DISTINCT "user_id", trim("category") FROM "todos" WHERE "category" IS NOT NULL AND trim("category") <> '' ON CONFLICT ("user_id","name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "categories" ("user_id","name") SELECT DISTINCT "user_id", trim("category") FROM "recurring_todos" WHERE "category" IS NOT NULL AND trim("category") <> '' ON CONFLICT ("user_id","name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "categories" ("user_id","name") SELECT DISTINCT "user_id", trim("category") FROM "recurring_allocations" WHERE "category" IS NOT NULL AND trim("category") <> '' ON CONFLICT ("user_id","name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "categories" ("user_id","name") SELECT DISTINCT "user_id", trim("category") FROM "category_colors" WHERE trim("category") <> '' ON CONFLICT ("user_id","name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "categories" ("user_id","name") SELECT DISTINCT "user_id", trim("payload"->>'category') FROM "events" WHERE "source" = 'manual' AND "payload"->>'category' IS NOT NULL AND trim("payload"->>'category') <> '' ON CONFLICT ("user_id","name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "categories" ("user_id","name","position") SELECT u."id", d.name, d.pos FROM "users" u CROSS JOIN (VALUES ('Coding',0),('Work',1),('Essentials',2),('Health',3),('Household',4)) AS d(name,pos) ON CONFLICT ("user_id","name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "category_colors" ("user_id","category","color") SELECT u."id", d.name, d.color FROM "users" u CROSS JOIN (VALUES ('Coding','#10b981'),('Work','#6366f1'),('Essentials','#f59e0b'),('Health','#f43f5e'),('Household','#0ea5e9')) AS d(name,color) ON CONFLICT ("user_id","category") DO NOTHING;
--> statement-breakpoint
UPDATE "goals" g SET "category_id" = c."id" FROM "categories" c WHERE c."user_id" = g."user_id" AND c."name" = trim(g."category") AND g."category" IS NOT NULL;
--> statement-breakpoint
UPDATE "todos" t SET "category_id" = c."id" FROM "categories" c WHERE c."user_id" = t."user_id" AND c."name" = trim(t."category") AND t."category" IS NOT NULL;
--> statement-breakpoint
UPDATE "recurring_todos" t SET "category_id" = c."id" FROM "categories" c WHERE c."user_id" = t."user_id" AND c."name" = trim(t."category") AND t."category" IS NOT NULL;
--> statement-breakpoint
UPDATE "recurring_allocations" a SET "category_id" = c."id" FROM "categories" c WHERE c."user_id" = a."user_id" AND c."name" = trim(a."category") AND a."category" IS NOT NULL;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "goals" ADD CONSTRAINT "goals_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "todos" ADD CONSTRAINT "todos_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "recurring_todos" ADD CONSTRAINT "recurring_todos_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "recurring_allocations" ADD CONSTRAINT "recurring_allocations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN IF EXISTS "category";
--> statement-breakpoint
ALTER TABLE "todos" DROP COLUMN IF EXISTS "category";
--> statement-breakpoint
ALTER TABLE "recurring_todos" DROP COLUMN IF EXISTS "category";
--> statement-breakpoint
ALTER TABLE "recurring_allocations" DROP COLUMN IF EXISTS "category";
