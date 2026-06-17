/**
 * Cloud (Postgres + Vercel Blob) is the authoritative source of truth for the
 * shared global workspace and is enabled by default. It can only be turned off
 * for local-only development by explicitly setting the flag to "false".
 */
export function isCloudPersistenceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED !== "false";
}
