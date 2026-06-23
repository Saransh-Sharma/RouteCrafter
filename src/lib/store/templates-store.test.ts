import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "./auth-store";
import { useTemplatesStore } from "./templates-store";
import type { Template } from "@/lib/types";

const template: Template = {
  id: "custom/template",
  name: "Custom template",
  description: "",
  category: "my-template",
  accent: "sage",
  project: {
    country: "",
    regions: [],
    positioning: "",
    targetAudience: "",
    travelStyles: [],
    travelerTypes: [],
    durations: [],
    brandStyle: {
      businessName: "",
      voice: "editorial",
      footerDisclaimer:
        "Live opening hours, prices, tickets, and availability should be verified before travel.",
    },
    productionPlan: {
      offerModel: "digital",
      channels: ["etsy"],
      outputs: [],
      editions: [],
      review: {},
    },
    tripConfigs: [],
    pdfTheme: "beige",
    promptTweaks: {},
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("templates store cloud sync", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    localStorage.clear();
    useAuthStore.setState({
      user: {
        id: "user_test",
        username: "test",
        displayName: "Test User",
        email: "test@example.com",
        role: "editor",
      },
      isHydrating: false,
      isSubmitting: false,
      error: null,
    });
    useTemplatesStore.setState({
      templates: [],
      hasHydrated: true,
      syncStatus: "idle",
      syncError: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("encodes template ids in delete requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await useTemplatesStore.getState().removeTemplate(template.id);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/templates/${encodeURIComponent(template.id)}`,
      { method: "DELETE", credentials: "include" },
    );
  });

  it("retries cloud operations after a transient 503 cooldown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValue(Response.json({ template }));
    vi.stubGlobal("fetch", fetchMock);

    await useTemplatesStore.getState().saveTemplate(template);
    await useTemplatesStore.getState().saveTemplate({
      ...template,
      id: "custom/template-2",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-01-01T00:00:06.000Z"));
    await useTemplatesStore.getState().saveTemplate({
      ...template,
      id: "custom/template-3",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
