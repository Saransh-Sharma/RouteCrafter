import { expect, it, vi } from "vitest";

it("finishes hydration with a recoverable error for corrupt storage", async () => {
  vi.resetModules();
  localStorage.setItem("routecrafter:v1", "{not-json");

  const { useProjectsStore } = await import("./projects-store");
  await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

  const state = useProjectsStore.getState();
  expect(state.hasHydrated).toBe(true);
  expect(state.initialized).toBe(true);
  expect(state.projects.length).toBeGreaterThan(0);
  expect(state.persistenceError).toContain("reset your local project cache");
  const recoveredStorage = localStorage.getItem("routecrafter:v1");
  expect(recoveredStorage).not.toBe("{not-json");
  expect(() => JSON.parse(recoveredStorage ?? "")).not.toThrow();
});
