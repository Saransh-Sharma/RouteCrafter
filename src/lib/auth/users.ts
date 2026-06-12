import type { User } from "../schemas/auth";

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

/** Map username → env-var key for passwords. */
const PASSWORD_ENV_MAP: Record<string, string> = {
  admin: "USER_ADMIN_PASSWORD",
  saransh: "USER_SARANSH_PASSWORD",
  saumya: "USER_SAUMYA_PASSWORD",
};

export function findUserByUsername(username: string): User | undefined {
  return USERS.find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
}

export function findUserByEmail(email: string): User | undefined {
  return USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string): User | undefined {
  return USERS.find((u) => u.id === id);
}

export function verifyPassword(username: string, password: string): boolean {
  const envKey = PASSWORD_ENV_MAP[username.toLowerCase()];
  if (!envKey) return false;
  const expected = process.env[envKey];
  if (!expected) return false;
  return password === expected;
}
