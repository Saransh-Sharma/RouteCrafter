-- Shared global workspace migration.
-- Projects become globally unique by id (one canonical row per id) instead of
-- being namespaced per user via the composite (user_id, id) primary key.

-- 1. Archive the rows that will lose the dedupe into project_versions so nothing
--    is silently discarded. A "losing" row is one where another row shares its id
--    with a higher revision, or equal revision but newer updated_at, or equal both
--    but a higher ctid (stable tie-break).
INSERT INTO "project_versions" ("id", "project_id", "user_id", "revision", "snapshot", "reason", "created_at")
SELECT gen_random_uuid(), p."id", p."user_id", p."revision", p."data", 'before-cloud-migration', now()
FROM "projects" p
WHERE EXISTS (
  SELECT 1 FROM "projects" q
  WHERE q."id" = p."id"
    AND ( q."revision" > p."revision"
       OR (q."revision" = p."revision" AND q."updated_at" > p."updated_at")
       OR (q."revision" = p."revision" AND q."updated_at" = p."updated_at" AND q."ctid" > p."ctid") )
);
--> statement-breakpoint

-- 2. Deduplicate projects sharing the same id across users.
DELETE FROM "projects" p
USING "projects" q
WHERE p."id" = q."id"
  AND ( p."revision" < q."revision"
     OR (p."revision" = q."revision" AND p."updated_at" < q."updated_at")
     OR (p."revision" = q."revision" AND p."updated_at" = q."updated_at" AND p."ctid" < q."ctid") );
--> statement-breakpoint

-- 3. Swap indexes and primary key to the shared (id-only) model.
DROP INDEX "projects_user_updated_idx";--> statement-breakpoint
DROP INDEX "projects_user_country_idx";--> statement-breakpoint
DROP INDEX "projects_user_status_idx";--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_user_id_id_pk";--> statement-breakpoint
ALTER TABLE "projects" ADD PRIMARY KEY ("id");--> statement-breakpoint
CREATE INDEX "projects_updated_idx" ON "projects" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "projects_country_idx" ON "projects" USING btree ("country");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");
