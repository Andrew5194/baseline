DROP INDEX "events_source_dedup_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "events_source_dedup_idx" ON "events" USING btree ("user_id","source","source_id","event_type");