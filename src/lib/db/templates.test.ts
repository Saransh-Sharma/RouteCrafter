// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();
const updateSetMock = vi.fn();
const updateWhereMock = vi.fn();
const updateReturningMock = vi.fn();
const insertValuesMock = vi.fn();
const insertReturningMock = vi.fn();

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })),
  desc: vi.fn((column: unknown) => ({ op: "desc", column })),
  eq: vi.fn((column: unknown, value: unknown) => ({ op: "eq", column, value })),
  isNull: vi.fn((column: unknown) => ({ op: "isNull", column })),
}));

vi.mock("./users", () => ({
  ensureUser: vi.fn(),
}));

vi.mock("./index", () => ({
  getDb: vi.fn(() => ({
    query: {
      templates: {
        findFirst: findFirstMock,
      },
    },
    update: vi.fn(() => ({
      set: updateSetMock.mockReturnValue({
        where: updateWhereMock.mockReturnValue({
          returning: updateReturningMock,
        }),
      }),
    })),
    insert: vi.fn(() => ({
      values: insertValuesMock.mockReturnValue({
        returning: insertReturningMock,
      }),
    })),
  })),
}));

import { templates } from "./schema";
import { upsertTemplateForUser } from "./templates";
import type { Template } from "@/lib/schemas";
import type { User } from "@/lib/schemas/auth";

const user: User = {
  id: "user_test",
  username: "test",
  displayName: "Test User",
  email: "test@example.com",
  role: "editor",
};

const template: Template = {
  id: "template_test",
  name: "Template",
  description: "",
  category: "my-template",
  accent: "sage",
  project: {
    country: "",
    regions: [],
    positioning: "",
    targetAudience: "",
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
        review: {
          liveDataVerified: false,
          presentationReviewed: false,
          backupConfirmed: false,
        },
      },
    tripConfigs: [],
    pdfTheme: "beige",
    promptTweaks: {},
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function expectActiveTemplatePredicate(predicate: unknown) {
  expect(predicate).toEqual({
    op: "and",
    conditions: expect.arrayContaining([
      { op: "eq", column: templates.id, value: template.id },
      { op: "eq", column: templates.userId, value: user.id },
      { op: "isNull", column: templates.deletedAt },
    ]),
  });
}

describe("template db helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstMock.mockResolvedValue(undefined);
    insertReturningMock.mockResolvedValue([{ data: template }]);
    updateReturningMock.mockResolvedValue([{ data: template }]);
  });

  it("only matches active templates when upserting", async () => {
    await upsertTemplateForUser({ user, template });

    expectActiveTemplatePredicate(findFirstMock.mock.calls[0]?.[0].where);
  });

  it("keeps the active-template predicate on updates", async () => {
    findFirstMock.mockResolvedValue({
      data: template,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await upsertTemplateForUser({ user, template });

    expectActiveTemplatePredicate(updateWhereMock.mock.calls[0]?.[0]);
  });
});
