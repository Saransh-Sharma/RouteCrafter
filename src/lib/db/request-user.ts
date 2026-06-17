import "server-only";

import type { User } from "@/lib/schemas/auth";
import { ensureUser } from "./users";

export async function ensureRequestUser(user: User): Promise<User> {
  await ensureUser(user);
  return user;
}
