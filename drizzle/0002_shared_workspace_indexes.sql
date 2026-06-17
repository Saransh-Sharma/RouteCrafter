DROP INDEX "ai_runs_project_idx";--> statement-breakpoint
CREATE INDEX "assets_project_idx" ON "assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ai_runs_project_idx" ON "ai_runs" USING btree ("project_id");