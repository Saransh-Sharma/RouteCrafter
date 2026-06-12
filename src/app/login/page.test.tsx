import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";
import { useAuthStore } from "@/lib/store/auth-store";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  redirect: null as string | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => ({
    get: (key: string) => (key === "redirect" ? navigation.redirect : null),
  }),
}));

const admin = {
  id: "user_admin",
  username: "admin",
  displayName: "Admin",
  email: "saransh1337@gmail.com",
  role: "admin" as const,
};

describe("login page", () => {
  beforeEach(() => {
    navigation.push.mockClear();
    navigation.redirect = null;
    useAuthStore.setState({
      user: null,
      isHydrating: false,
      isSubmitting: false,
      error: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ user: admin, ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  it(
    "enables password submission and rejects unsafe redirects",
    async () => {
      navigation.redirect = "javascript:document.body.dataset.xss='executed'";
      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText("Username"), {
        target: { value: "admin" },
      });
      fireEvent.change(screen.getByPlaceholderText("••••••••"), {
        target: { value: "admin-password" },
      });
      const submit = screen.getByRole("button", { name: "Sign in" });
      expect(submit).not.toHaveProperty("disabled", true);
      fireEvent.click(submit);

      await waitFor(
        () => expect(navigation.push).toHaveBeenCalledWith("/"),
        { timeout: 10_000 },
      );
    },
    15_000,
  );

  it("supports keyboard tab navigation with complete ARIA relationships", () => {
    render(<LoginPage />);
    const passwordTab = screen.getByRole("tab", { name: "Password" });
    const otpTab = screen.getByRole("tab", { name: "Email OTP" });

    expect(passwordTab.getAttribute("aria-controls")).toBe(
      "login-panel-password",
    );
    fireEvent.keyDown(passwordTab, { key: "ArrowRight" });

    expect(otpTab.getAttribute("aria-selected")).toBe("true");
    expect(otpTab.getAttribute("aria-controls")).toBe("login-panel-otp");
    expect(screen.getByRole("tabpanel")).toBeDefined();
  });

  it("uses username for OTP and enables verification after six digits", async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Email OTP" }));
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "saransh" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    await screen.findByText(/registered email for/);
    for (let index = 1; index <= 6; index += 1) {
      fireEvent.change(screen.getByLabelText(`Digit ${index}`), {
        target: { value: String(index) },
      });
    }

    expect(
      screen.getByRole("button", { name: "Verify & sign in" }),
    ).not.toHaveProperty("disabled", true);
  });
});
