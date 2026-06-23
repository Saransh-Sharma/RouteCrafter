CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"accent" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "templates_updated_idx" ON "templates" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX "templates_category_idx" ON "templates" USING btree ("category");
--> statement-breakpoint
CREATE INDEX "templates_user_active_updated_idx" ON "templates" USING btree ("user_id","deleted_at","updated_at");
