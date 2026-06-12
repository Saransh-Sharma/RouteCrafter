import type { User } from "../schemas/auth";
import { timingSafeEqual } from "node:crypto";
import { readUserPassword } from "./config";

/**
 * Hardcoded user registry for the 3 known users.
 * Passwords are loaded from environment variables at runtime.
 */
export const USERS: User[] = [
  {
    id: "user_admin",
    username: "admin",
    displayName: "Admin",
    email: "saransh1337@gmail.com",
    role: "admin",
  },
  {
    id: "user_saransh",
    username: "saransh",
    displayName: "Saransh",
    email: "saransh1337@gmail.com",
    role: "editor",
  },
  {
    id: "user_saumya",
    username: "saumya",
    displayName: "Saumya",
    email: "saumya.vaishnav@gmail.com",
    role: "editor",
  },
];

export function findUserByUsername(username: string): User | undefined {
  return USERS.find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
}

export function findUserById(id: string): User | undefined {
  return USERS.find((u) => u.id === id);
}

export function verifyPassword(username: string, password: string): boolean {
  const expected = readUserPassword(username);
  if (!expected) return false;

  const actualBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}
