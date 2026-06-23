import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const projects = pgTable(
  "projects",
  {
    // Project ids are globally unique in the shared workspace; one canonical row per id.
    id: text("id").primaryKey(),
    // Creator attribution only. Data is shared across all users; queries are NOT scoped by this.
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    country: text("country").notNull().default(""),
    status: text("status").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    revision: integer("revision").notNull().default(1),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    updatedByUserId: text("updated_by_user_id"),
  },
  (table) => ({
    updatedIdx: index("projects_updated_idx").on(table.updatedAt),
    countryIdx: index("projects_country_idx").on(table.country),
    statusIdx: index("projects_status_idx").on(table.status),
  }),
);

export const templates = pgTable(
  "templates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    category: text("category").notNull(),
    accent: text("accent").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    updatedByUserId: text("updated_by_user_id"),
  },
  (table) => ({
    updatedIdx: index("templates_updated_idx").on(table.updatedAt),
    categoryIdx: index("templates_category_idx").on(table.category),
    userActiveUpdatedIdx: index("templates_user_active_updated_idx").on(
      table.userId,
      table.deletedAt,
      table.updatedAt,
    ),
  }),
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey(),
    projectId: text("project_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    detail: text("detail").notNull().default(""),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    userProjectCreatedIdx: index("activity_user_project_created_idx").on(
      table.userId,
      table.projectId,
      table.createdAt,
    ),
    projectCreatedIdx: index("activity_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  }),
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey(),
    projectId: text("project_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    country: text("country").notNull().default(""),
    editionLabel: text("edition_label"),
    assetType: text("asset_type").notNull(),
    source: text("source").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes"),
    blobUrl: text("blob_url").notNull(),
    blobPathname: text("blob_pathname").notNull(),
    width: integer("width"),
    height: integer("height"),
    checksum: text("checksum"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    userCreatedIdx: index("assets_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    userCountryIdx: index("assets_user_country_idx").on(
      table.userId,
      table.country,
    ),
    userTypeIdx: index("assets_user_type_idx").on(
      table.userId,
      table.assetType,
    ),
    userProjectIdx: index("assets_user_project_idx").on(
      table.userId,
      table.projectId,
    ),
    // Shared workspace lists assets by project without a user filter, so a
    // project-leading index matches the de-scoped query in listAssets.
    projectIdx: index("assets_project_idx").on(table.projectId),
  }),
);

export const assetUsages = pgTable(
  "asset_usages",
  {
    id: uuid("id").primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id),
    projectId: text("project_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    usageType: text("usage_type").notNull(),
    entityId: text("entity_id"),
    fieldPath: text("field_path").notNull(),
    projectRevision: integer("project_revision"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
  },
  (table) => ({
    assetActiveIdx: index("asset_usages_asset_active_idx").on(
      table.assetId,
      table.clearedAt,
    ),
    projectIdx: index("asset_usages_project_idx").on(
      table.userId,
      table.projectId,
    ),
  }),
);

export const aiRuns = pgTable(
  "ai_runs",
  {
    id: uuid("id").primaryKey(),
    projectId: text("project_id"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    taskType: text("task_type").notNull(),
    label: text("label").notNull(),
    source: text("source"),
    credentialSource: text("credential_source").notNull(),
    status: text("status").notNull(),
    usage: jsonb("usage"),
    estimatedCost: jsonb("estimated_cost"),
    assetId: uuid("asset_id").references(() => assets.id),
    projectRevision: integer("project_revision"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    error: text("error"),
  },
  (table) => ({
    userCreatedIdx: index("ai_runs_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    // De-scoped from the workspace: project-scoped lookups no longer filter by
    // user, so lead the index with project_id.
    projectIdx: index("ai_runs_project_idx").on(table.projectId),
  }),
);

export const projectVersions = pgTable(
  "project_versions",
  {
    id: uuid("id").primaryKey(),
    projectId: text("project_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    revision: integer("revision").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    projectRevisionIdx: index("project_versions_project_revision_idx").on(
      table.projectId,
      table.revision,
    ),
    userProjectCreatedIdx: index("project_versions_user_project_created_idx").on(
      table.userId,
      table.projectId,
      table.createdAt,
    ),
  }),
);

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  aiDefaults: jsonb("ai_defaults").notNull(),
  customModels: jsonb("custom_models").notNull(),
  dismissedCoachMarks: jsonb("dismissed_coach_marks").notNull(),
  libraryView: jsonb("library_view").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    eventType: text("event_type").notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    userCreatedIdx: index("audit_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    typeCreatedIdx: index("audit_type_created_idx").on(
      table.eventType,
      table.createdAt,
    ),
  }),
);
