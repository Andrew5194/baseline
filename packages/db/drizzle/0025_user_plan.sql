ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan" text NOT NULL DEFAULT 'free';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan_source" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan_expires_at" timestamptz;
