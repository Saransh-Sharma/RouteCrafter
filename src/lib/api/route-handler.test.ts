import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectNotFoundError } from "@/lib/db/projects";
import {
  jsonNoStore,
  parseBody,
  withUser,
} from "./route-handler";
import { z } from "zod";

const user = {
  id: "user_test",
  username: "test",
  displayName: "Test User",
  email: "test@example.com",
  role: "editor" as const,
};

const getSessionUserMock = vi.hoisted(() => vi.fn());
const ensureRequestUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/db/request-user", () => ({
  ensureRequestUser: ensureRequestUserMock,
}));

describe("route-handler helpers", () => {
  beforeEach(() => {
    getSessionUserMock.mockReset();
    ensureRequestUserMock.mockReset();
    ensureRequestUserMock.mockResolvedValue(user);
  });

  it("returns unauthorized before invoking a route handler", async () => {
    getSessionUserMock.mockResolvedValue(null);
    const handler = vi.fn();
    const response = await withUser(handler)();

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("ensures the request user and delegates route errors", async () => {
    getSessionUserMock.mockResolvedValue(user);
    const response = await withUser(async () => {
      throw new ProjectNotFoundError("Missing project.");
    })();

    expect(ensureRequestUserMock).toHaveBeenCalledWith(user);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Missing project." });
  });

  it("validates JSON request bodies", async () => {
    const schema = z.object({ name: z.string().min(1) });
    const request = new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });

    const parsed = await parseBody(request, schema, "Invalid payload.");

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.response.status).toBe(400);
      await expect(parsed.response.json()).resolves.toEqual({
        error: "Invalid payload.",
      });
    }
  });

  it("sets no-store on JSON responses", () => {
    const response = jsonNoStore({ ok: true });

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
