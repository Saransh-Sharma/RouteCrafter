import "server-only";

import { eq } from "drizzle-orm";
import type { User } from "@/lib/schemas/auth";
import { USERS } from "@/lib/auth/users";
import { getDb } from "./index";
import { users } from "./schema";

export async function ensureUser(user: User): Promise<void> {
  const now = new Date();
  await getDb()
    .insert(users)
    .values({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        updatedAt: now,
      },
    });
}

export async function seedKnownUsers(): Promise<void> {
  for (const user of USERS) {
    await ensureUser(user);
  }
}

export async function userExists(userId: string): Promise<boolean> {
  const row = await getDb().query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true },
  });
  return Boolean(row);
}
