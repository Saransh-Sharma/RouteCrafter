import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export class DatabaseConfigurationError extends Error {
  status = 503;
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new DatabaseConfigurationError(
      "DATABASE_URL is not configured. Connect Vercel Postgres/Neon and pull the environment locally.",
    );
  }
  return drizzle(neon(url), { schema });
}

export type DbClient = ReturnType<typeof getDb>;
