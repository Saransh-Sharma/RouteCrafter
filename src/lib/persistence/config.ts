export function isCloudPersistenceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED === "true";
}
