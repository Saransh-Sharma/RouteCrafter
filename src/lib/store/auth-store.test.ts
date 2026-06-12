import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "./auth-store";

const admin = {
  id: "user_admin",
  username: "admin",
  displayName: "Admin",
  email: "saransh1337@gmail.com",
  role: "admin" as const,
};

describe("auth store", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isHydrating: false,
      isSubmitting: false,
      error: null,
    });
    vi.unstubAllGlobals();
  });

  it("starts idle so login forms can submit", () => {
    expect(useAuthStore.getState()).toMatchObject({
      isHydrating: false,
      isSubmitting: false,
    });
  });

  it("preserves server authentication errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Invalid username or password" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      useAuthStore.getState().login("admin", "wrong"),
    ).rejects.toThrow("Invalid username or password");
    expect(useAuthStore.getState()).toMatchObject({
      error: "Invalid username or password",
      isSubmitting: false,
    });
  });

  it("uses a network error only when no server response exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(
      useAuthStore.getState().login("admin", "secret"),
    ).rejects.toThrow("offline");
    expect(useAuthStore.getState().error).toBe(
      "Network error. Please try again.",
    );
  });

  it("stores a successful user and sends username-based OTP payloads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: admin }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await useAuthStore.getState().login("admin", "secret");
    await useAuthStore.getState().sendOtp("saransh");

    expect(useAuthStore.getState().user).toEqual(admin);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/auth/otp/send",
      expect.objectContaining({ body: JSON.stringify({ username: "saransh" }) }),
    );
  });
});
